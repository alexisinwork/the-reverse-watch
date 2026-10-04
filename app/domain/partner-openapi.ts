/**
 * The partner API described as OpenAPI 3.1, served at /api/v1/openapi.json.
 * Request shapes come from the same zod schemas the API validates with, so
 * the document can't drift from the code.
 */
import { z } from "zod";

import { FILM_SUBJECT_KINDS } from "./film-subject";
import { profileV4Schema } from "./questionnaire-v4";

const watchSchema = {
  type: "object",
  required: [
    "brand",
    "model",
    "referenceCode",
    "sourceUrl",
    "imageUrl",
    "rationale",
    "details",
  ],
  properties: {
    brand: { type: "string" },
    model: { type: "string" },
    referenceCode: { type: ["string", "null"] },
    sourceUrl: {
      type: "string",
      description: "The maker's or authorised retailer's page.",
    },
    imageUrl: {
      type: ["string", "null"],
      description: "A photo URL (never a stored file).",
    },
    priceNote: { type: ["string", "null"] },
    rationale: { type: "string", description: "Why this watch fits." },
    details: {
      type: "object",
      description:
        "Price, size, water resistance, movement, materials, and for film searches who wore it and where. reviewStatus 'pending' means 'Not yet reviewed'; referenceVerified false means 'Manufacturer reference not confirmed'.",
      additionalProperties: true,
    },
  },
} as const;

const searchResult = {
  oneOf: [
    {
      type: "object",
      required: ["status", "watches", "summary"],
      properties: {
        status: { const: "found" },
        summary: { type: "string" },
        fromCache: { type: "boolean" },
        origin: { enum: ["catalogue", "live", "mixed"] },
        watches: {
          type: "array",
          items: { $ref: "#/components/schemas/Watch" },
        },
        alsoWorth: {
          type: "array",
          description:
            "Fits every answer, but no maker's page confirmed the reference. Show with the label 'Manufacturer reference not confirmed'.",
          items: { $ref: "#/components/schemas/Watch" },
        },
      },
    },
    {
      type: "object",
      required: ["status", "summary"],
      properties: {
        status: { const: "no_match" },
        summary: { type: "string" },
      },
    },
    {
      type: "object",
      required: ["status"],
      properties: { status: { const: "unavailable" } },
    },
  ],
} as const;

const errorResponse = {
  description: "An error",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
    },
  },
} as const;

const errors = {
  "400": errorResponse,
  "401": errorResponse,
  "403": errorResponse,
  "429": errorResponse,
} as const;

const streamNote =
  "Add `Accept: text/event-stream` (or `stream=1`) to receive server-sent events: `progress` events ({ text, watch? }) while the search runs, then one `result` event with the same body as the JSON response.";

function jsonOk(schema: unknown, description = "OK") {
  return {
    description,
    content: {
      "application/json": { schema },
      "text/event-stream": {
        schema: { type: "string", description: streamNote },
      },
    },
  };
}

export function partnerOpenApi(serverUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "The Reserve partner API",
      version: "1.0.0",
      description: [
        "Watch recommendations from The Reserve for partner websites.",
        "",
        "**Keys.** From your server send `Authorization: Bearer sk_live_…` (never put the secret key in a web page). From your website's own pages send your public key as `X-Reserve-Key: pk_live_…` or `?key=pk_live_…`; it only works from the website addresses registered for it.",
        "",
        "**Privacy.** Send search answers only. Never send names, emails or other personal data; none is accepted, stored, or passed to the AI search.",
        "",
        "**Labels.** Keep the labels the data carries: 'Not yet reviewed' (details.reviewStatus = pending) and 'Manufacturer reference not confirmed' (alsoWorth). Prices are approximate.",
      ].join("\n"),
    },
    servers: [{ url: serverUrl }],
    security: [{ secretKey: [] }, { publicKey: [] }, { publicKeyQuery: [] }],
    components: {
      securitySchemes: {
        secretKey: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "sk_live_…",
        },
        publicKey: { type: "apiKey", in: "header", name: "X-Reserve-Key" },
        publicKeyQuery: { type: "apiKey", in: "query", name: "key" },
      },
      schemas: {
        Watch: watchSchema,
        SearchResult: searchResult,
        QuizAnswers: z.toJSONSchema(profileV4Schema, {
          io: "input",
          unrepresentable: "any",
        }),
        Error: {
          type: "object",
          required: ["error"],
          properties: {
            error: {
              type: "object",
              required: ["code", "message"],
              properties: {
                code: {
                  enum: [
                    "missing_key",
                    "invalid_key",
                    "origin_not_allowed",
                    "secret_key_in_browser",
                    "invalid_request",
                    "invalid_answers",
                    "invalid_json",
                    "too_large",
                    "rate_limited",
                    "monthly_limit",
                    "unavailable",
                    "not_found",
                  ],
                },
                message: { type: "string" },
              },
            },
          },
        },
      },
    },
    paths: {
      "/api/v1/quiz": {
        get: {
          summary: "The diagnostic's choices",
          description:
            "Price ranges, currencies, wrist limits, wearing scenarios, movement types and complications, to build your own form.",
          responses: { "200": { description: "OK" }, ...errors },
        },
        post: {
          summary: "A shortlist for the diagnostic's answers",
          description: `Body: the answers as JSON (application/json, or text/plain to avoid a browser preflight). The case-diameter range, when given, is what is enforced; otherwise it follows the wrist. ${streamNote}`,
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/QuizAnswers" },
              },
            },
          },
          responses: {
            "200": jsonOk({
              type: "object",
              properties: {
                result: { $ref: "#/components/schemas/SearchResult" },
              },
            }),
            ...errors,
          },
        },
      },
      "/api/v1/find": {
        get: {
          summary: "Watches from a film, series or person",
          description: streamNote,
          parameters: [
            {
              name: "q",
              in: "query",
              required: true,
              schema: { type: "string", minLength: 2, maxLength: 120 },
            },
            {
              name: "type",
              in: "query",
              required: true,
              schema: { enum: [...FILM_SUBJECT_KINDS] },
            },
          ],
          responses: {
            "200": jsonOk({
              type: "object",
              properties: {
                result: { $ref: "#/components/schemas/SearchResult" },
              },
            }),
            ...errors,
          },
        },
      },
      "/api/v1/alternatives": {
        get: {
          summary: "Cheaper alternatives to a named watch",
          description: `If several watches share the name, the result is { status: "ambiguous", options: [{ label, name, reference }] }: ask again with name and ref from one option. ${streamNote}`,
          parameters: [
            {
              name: "name",
              in: "query",
              schema: { type: "string", maxLength: 120 },
              description: "e.g. Tudor Black Bay 58",
            },
            {
              name: "ref",
              in: "query",
              schema: { type: "string", maxLength: 60 },
            },
            {
              name: "mode",
              in: "query",
              required: true,
              schema: { enum: ["exact", "range"] },
            },
            {
              name: "amount",
              in: "query",
              schema: { type: "number", minimum: 50 },
              description: "mode=exact: around this price (± 1,000).",
            },
            {
              name: "range",
              in: "query",
              schema: { type: "string" },
              description:
                "mode=range: a price range id from GET /api/v1/quiz.",
            },
            {
              name: "currency",
              in: "query",
              schema: { enum: ["USD", "EUR", "GBP", "CHF"] },
            },
            {
              name: "quartz",
              in: "query",
              required: true,
              schema: { enum: ["yes", "no"] },
            },
          ],
          responses: {
            "200": jsonOk({
              type: "object",
              properties: {
                target: {
                  type: ["object", "null"],
                  description: "The named watch: { card: Watch, preowned }.",
                },
                result: { $ref: "#/components/schemas/SearchResult" },
              },
            }),
            ...errors,
          },
        },
      },
      "/api/v1/archetype": {
        get: {
          summary: "The watch archetype quiz",
          description:
            "Without parameters: the four questions and their values. With all four answers: the archetype and ten watches chosen for it. No AI call.",
          parameters: [
            "socialSignal",
            "aestheticDna",
            "deploymentEnvironment",
            "priceComfort",
          ].map((name) => ({ name, in: "query", schema: { type: "string" } })),
          responses: { "200": { description: "OK" }, ...errors },
        },
      },
      "/api/v1/stories": {
        get: {
          summary: "Reviewed film and celebrity watch stories",
          responses: { "200": { description: "OK" }, ...errors },
        },
      },
      "/api/v1/stories/{slug}": {
        get: {
          summary: "One story with its named sources",
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": { description: "OK" },
            "404": errorResponse,
            ...errors,
          },
        },
      },
    },
  };
}

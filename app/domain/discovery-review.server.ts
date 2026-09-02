import { createHash } from "node:crypto";

import { z } from "zod";

import {
  discoveryResearchCandidateSchema,
  type DiscoveryResearchCandidate,
} from "./discovery-research";

const MAX_SOURCE_BYTES = 256_000;
const MAX_SOURCE_COUNT = 12;

export const discoveryReviewRequestSchema = z
  .object({
    candidateId: z.number().int().positive(),
    decision: z.enum(["accepted", "rejected"]),
    publish: z.boolean().default(false),
    reviewerNote: z.string().trim().max(1_000).nullable().default(null),
    referenceVariantId: z.uuid().nullable().default(null),
    rights: z.unknown().nullable().default(null),
    castCredit: z
      .object({
        publicFigureEntityId: z.number().int().positive(),
        fictionalCharacterEntityId: z.number().int().positive(),
        workId: z.number().int().positive(),
        decision: z.enum(["accepted", "rejected"]),
      })
      .strict()
      .nullable()
      .default(null),
  })
  .strict()
  .superRefine((request, context) => {
    if (request.decision === "rejected" && request.publish) {
      context.addIssue({
        code: "custom",
        path: ["publish"],
        message: "A rejected candidate cannot be published.",
      });
    }
    if (request.castCredit !== null && request.decision !== "accepted") {
      context.addIssue({
        code: "custom",
        path: ["castCredit"],
        message: "Cast credits require an accepted candidate review.",
      });
    }
    if (request.castCredit !== null && !request.publish) {
      context.addIssue({
        code: "custom",
        path: ["castCredit"],
        message: "Cast credits require accepted canonical entities and work.",
      });
    }
  });

export type DiscoveryReviewRequest = z.infer<
  typeof discoveryReviewRequestSchema
>;

export function parseDiscoveryReviewConfiguration(
  env: NodeJS.ProcessEnv = process.env,
) {
  const missing: string[] = [];
  const required = (name: string) => {
    const value = env[name]?.trim();
    if (!value) missing.push(name);
    return value ?? "";
  };
  const config = {
    supabaseUrl: required("SUPABASE_URL"),
    serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    reviewSecret: required("DISCOVERY_RESEARCH_REVIEW_SECRET"),
  };
  return missing.length > 0
    ? { configured: false as const, missing }
    : { configured: true as const, config };
}

export function reviewSecretMatches(supplied: string | null, expected: string) {
  return Boolean(supplied && expected && supplied === `Bearer ${expected}`);
}

export const discoveryCandidateSourceRecordSchema = z
  .object({
    id: z.number().int().positive(),
    url: z.url(),
  })
  .strict();

export type DiscoveryCandidateSourceRecord = z.infer<
  typeof discoveryCandidateSourceRecordSchema
>;

export const discoverySourceFetchOutcomeSchema = z
  .object({
    sourceId: z.number().int().positive(),
    url: z.url(),
    status: z.enum(["verified", "failed"]),
    fetchedAt: z.iso.datetime({ offset: true }),
    contentHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable(),
    failureCategory: z
      .enum([
        "circular_source",
        "unsafe_source",
        "redirect_not_followed",
        "http_error",
        "too_large",
        "fetch_failed",
      ])
      .nullable(),
  })
  .strict();

export type DiscoverySourceFetchOutcome = z.infer<
  typeof discoverySourceFetchOutcomeSchema
>;

export type DiscoveryPublicationRights = {
  imageState:
    | "no_image_stored"
    | "licensed_asset"
    | "owned_asset"
    | "public_domain_asset"
    | "external_embed_cleared";
  assetUrl: string | null;
  rightsBasis: string | null;
  rightsHolder: string | null;
  licenceName: string | null;
  licenceUrl: string | null;
  creditLine: string | null;
  expiresAt: string | null;
  reviewedAt: string;
  editorialNote: string | null;
};

const rightsSchema = z
  .object({
    imageState: z.enum([
      "no_image_stored",
      "licensed_asset",
      "owned_asset",
      "public_domain_asset",
      "external_embed_cleared",
    ]),
    assetUrl: z.url().nullable(),
    rightsBasis: z.string().trim().min(1).nullable(),
    rightsHolder: z.string().trim().min(1).nullable(),
    licenceName: z.string().trim().min(1).nullable(),
    licenceUrl: z.url().nullable(),
    creditLine: z.string().trim().min(1).nullable(),
    expiresAt: z.iso.datetime({ offset: true }).nullable(),
    reviewedAt: z.iso.datetime({ offset: true }),
    editorialNote: z.string().trim().min(1).nullable(),
  })
  .strict()
  .superRefine((rights, context) => {
    if (rights.imageState === "no_image_stored") {
      if (rights.assetUrl !== null) {
        context.addIssue({
          code: "custom",
          path: ["assetUrl"],
          message: "No-image decisions cannot attach an asset.",
        });
      }
      return;
    }
    if (rights.assetUrl === null || rights.rightsBasis === null) {
      context.addIssue({
        code: "custom",
        path: ["rightsBasis"],
        message: "An image asset requires a rights basis and URL.",
      });
    }
  });

export function parseDiscoveryPublicationRights(value: unknown) {
  return rightsSchema.safeParse(value);
}

function hostIsPrivate(hostname: string) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (
    host === "localhost" ||
    host === "localhost.localdomain" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local")
  )
    return true;
  const octets = host.split(".").map(Number);
  if (
    octets.length === 4 &&
    octets.every(
      (octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255,
    )
  ) {
    return (
      octets[0] === 10 ||
      octets[0] === 127 ||
      (octets[0] === 172 && octets[1]! >= 16 && octets[1]! <= 31) ||
      (octets[0] === 192 && octets[1] === 168) ||
      (octets[0] === 169 && octets[1] === 254)
    );
  }
  return false;
}

function sourceSafety(url: string, applicationOrigin: string | undefined) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "unsafe_source" as const;
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    hostIsPrivate(parsed.hostname)
  )
    return "unsafe_source" as const;
  try {
    const applicationHost = applicationOrigin
      ? new URL(applicationOrigin).hostname
      : "thereserve.watch";
    if (parsed.hostname.toLowerCase() === applicationHost.toLowerCase())
      return "circular_source" as const;
  } catch {
    return "unsafe_source" as const;
  }
  return null;
}

async function readBoundedBody(response: Response) {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    total += next.value.byteLength;
    if (total > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("source_too_large");
    }
    chunks.push(next.value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export async function independentlyFetchDiscoverySources(
  sources: DiscoveryCandidateSourceRecord[],
  {
    applicationOrigin = process.env.APP_URL,
    fetchImpl = fetch,
    now = () => new Date().toISOString(),
    timeoutMs = 5_000,
  }: {
    applicationOrigin?: string;
    fetchImpl?: typeof fetch;
    now?: () => string;
    timeoutMs?: number;
  } = {},
) {
  const boundedSources = sources.slice(0, MAX_SOURCE_COUNT);
  return Promise.all(
    boundedSources.map(async (source): Promise<DiscoverySourceFetchOutcome> => {
      const fetchedAt = now();
      const safety = sourceSafety(source.url, applicationOrigin);
      if (safety) {
        return {
          sourceId: source.id,
          url: source.url,
          status: "failed",
          fetchedAt,
          contentHash: null,
          failureCategory: safety,
        };
      }
      try {
        const response = await fetchImpl(source.url, {
          method: "GET",
          redirect: "manual",
          headers: { Accept: "text/html,application/xhtml+xml,text/plain" },
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (response.status >= 300 && response.status < 400)
          return {
            sourceId: source.id,
            url: source.url,
            status: "failed",
            fetchedAt,
            contentHash: null,
            failureCategory: "redirect_not_followed",
          };
        if (!response.ok)
          return {
            sourceId: source.id,
            url: source.url,
            status: "failed",
            fetchedAt,
            contentHash: null,
            failureCategory: "http_error",
          };
        const contentLength = Number(response.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_BYTES)
          return {
            sourceId: source.id,
            url: source.url,
            status: "failed",
            fetchedAt,
            contentHash: null,
            failureCategory: "too_large",
          };
        const body = await readBoundedBody(response);
        return {
          sourceId: source.id,
          url: source.url,
          status: "verified",
          fetchedAt,
          contentHash: createHash("sha256").update(body).digest("hex"),
          failureCategory: null,
        };
      } catch (error) {
        return {
          sourceId: source.id,
          url: source.url,
          status: "failed",
          fetchedAt,
          contentHash: null,
          failureCategory:
            error instanceof Error && error.message === "source_too_large"
              ? "too_large"
              : "fetch_failed",
        };
      }
    }),
  );
}

export function evaluateDiscoveryPromotion({
  candidate,
  sourceOutcomes,
  publish,
  referenceVariantReviewed,
  rights,
}: {
  candidate: DiscoveryResearchCandidate;
  sourceOutcomes: DiscoverySourceFetchOutcome[];
  publish: boolean;
  referenceVariantReviewed: boolean;
  rights: unknown;
}) {
  const reasons: string[] = [];
  if (!discoveryResearchCandidateSchema.safeParse(candidate).success)
    reasons.push("candidate_schema_invalid");
  if (sourceOutcomes.length !== candidate.sources.length)
    reasons.push("source_fetch_incomplete");
  if (sourceOutcomes.some((source) => source.status !== "verified"))
    reasons.push("source_fetch_failed");
  if (
    candidate.identificationPrecision === "exact_reference" &&
    !candidate.exactReference
  )
    reasons.push("unsupported_exact_reference");
  if (
    candidate.identificationPrecision === "exact_reference" &&
    referenceVariantReviewed === false
  )
    reasons.push("catalogue_variant_not_reviewed");
  if (publish) {
    if (candidate.contradictionState !== "clear")
      reasons.push("unresolved_contradiction");
    if (candidate.customPropPossible) reasons.push("possible_custom_prop");
    if (candidate.identificationPrecision !== "exact_reference")
      reasons.push("publication_requires_exact_reference");
    if (!parseDiscoveryPublicationRights(rights).success)
      reasons.push("rights_decision_invalid");
  }
  return { allowed: reasons.length === 0, reasons };
}

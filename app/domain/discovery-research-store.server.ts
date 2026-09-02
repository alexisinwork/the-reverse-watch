import { z } from "zod";

import {
  discoveryAnchorSchema,
  discoveryTopicStatusSchema,
} from "./discovery-selection";

export const DISCOVERY_RESEARCH_ENQUEUE_RPC =
  "enqueue_discovery_research_v1" as const;
export const DISCOVERY_RESEARCH_STATUS_RPC =
  "discovery_research_status_v1" as const;

const tokenSchema = z.string().regex(/^[a-f0-9]{48}$/);
const requestSchema = z
  .object({
    anchor: discoveryAnchorSchema,
    displayText: z
      .string()
      .trim()
      .min(2)
      .max(160)
      .refine(
        (value) => !/[\u0000-\u001f\u007f]/.test(value),
        "Research text cannot contain control characters.",
      )
      .refine(
        (value) => !/https?:\/\//i.test(value),
        "Research text cannot contain a URL.",
      ),
    releaseYear: z.number().int().min(1888).max(2100).nullable(),
  })
  .strict();
const enqueueResponseSchema = z
  .object({ token: tokenSchema, status: discoveryTopicStatusSchema })
  .strict();
const statusResponseSchema = z
  .object({ status: discoveryTopicStatusSchema })
  .strict();

type Options = {
  env?: Partial<
    Pick<NodeJS.ProcessEnv, "SUPABASE_URL" | "SUPABASE_PUBLISHABLE_KEY">
  >;
  fetchImpl?: typeof fetch;
};

function config(env: Options["env"]) {
  const url = env?.SUPABASE_URL?.trim();
  const key = env?.SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && key ? { url, key } : null;
}

export async function enqueueDiscoveryResearch(
  request: z.input<typeof requestSchema>,
  { env = process.env, fetchImpl = fetch }: Options = {},
) {
  const configured = config(env);
  if (!configured) return null;
  const parsed = requestSchema.parse(request);
  const response = await fetchImpl(
    new URL(`/rest/v1/rpc/${DISCOVERY_RESEARCH_ENQUEUE_RPC}`, configured.url),
    {
      method: "POST",
      headers: { apikey: configured.key, "content-type": "application/json" },
      body: JSON.stringify({
        p_anchor_kind: parsed.anchor,
        p_display_text: parsed.displayText,
        p_release_year: parsed.releaseYear,
      }),
      signal: AbortSignal.timeout(2_000),
    },
  );
  if (!response.ok)
    throw new Error(`Discovery research enqueue returned ${response.status}.`);
  return enqueueResponseSchema.parse(await response.json());
}

export async function loadDiscoveryResearchStatus(
  token: string,
  { env = process.env, fetchImpl = fetch }: Options = {},
) {
  const configured = config(env);
  if (!configured) return null;
  const response = await fetchImpl(
    new URL(`/rest/v1/rpc/${DISCOVERY_RESEARCH_STATUS_RPC}`, configured.url),
    {
      method: "POST",
      headers: { apikey: configured.key, "content-type": "application/json" },
      body: JSON.stringify({ p_token: tokenSchema.parse(token) }),
      signal: AbortSignal.timeout(2_000),
    },
  );
  if (!response.ok) return null;
  const body: unknown = await response.json();
  return body === null ? null : statusResponseSchema.parse(body);
}

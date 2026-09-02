import {
  listPublishedDiscoveryStories,
  publishedDiscoveryStoriesSchema,
} from "../app/domain/discovery-public";
import { DISCOVERY_PUBLISHED_STORIES_RPC } from "../app/domain/discovery-store.server";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();

if (!supabaseUrl || !publishableKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY are required for discovery parity.",
  );
}

const response = await fetch(
  new URL(`/rest/v1/rpc/${DISCOVERY_PUBLISHED_STORIES_RPC}`, supabaseUrl),
  {
    method: "POST",
    headers: { apikey: publishableKey, "content-type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(5_000),
  },
);
if (!response.ok) {
  throw new Error(`Published discovery RPC returned ${response.status}.`);
}

const actual = publishedDiscoveryStoriesSchema.parse(await response.json());
const expected = listPublishedDiscoveryStories();
function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(",")}}`;
  }
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    !Number.isNaN(Date.parse(value))
  ) {
    return JSON.stringify(new Date(value).toISOString());
  }
  return JSON.stringify(value);
}

if (canonicalJson(actual) !== canonicalJson(expected)) {
  throw new Error(
    "Published discovery RPC does not match the reviewed fixture.",
  );
}

console.log(`Discovery parity passed for ${actual.length} reviewed stories.`);

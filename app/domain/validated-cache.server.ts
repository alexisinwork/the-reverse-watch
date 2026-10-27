import { z } from "zod";
import type { FoundWatch } from "./ai-watch-types";
import { safeHttpUrl } from "./source-pages.server";
import { validationCharges } from "./validation-budget.server";
import { rpc, type CatalogueClient } from "./watch-catalogue.server";

const evidenceSchema = z.object({
  provider: z.enum(["perplexity", "muse"]),
  sourceUrl: z.string().url(),
  checkedAt: z.string().datetime({ offset: true }),
});
const watchSchema = z.object({
  brand: z.string().min(1),
  model: z.string().min(1),
  referenceCode: z.string().min(1),
  sourceUrl: z.string(),
  imageUrl: z.string().nullable(),
  priceNote: z.string().nullable(),
  rationale: z.string(),
  details: z
    .object({ validationEvidence: z.array(evidenceSchema).length(2) })
    .passthrough(),
});
const snapshotSchema = z
  .object({
    validationStatus: z.literal("valid"),
    summary: z.string().min(1),
    watches: z.array(watchSchema).min(1).max(8),
    validatedAt: z.string(),
    policyVersion: z.literal("source-v1"),
  })
  .nullable();

export async function loadValidatedSnapshot(
  client: CatalogueClient,
  cacheKey: string,
) {
  if (!/^[0-9a-f]{64}$/.test(cacheKey)) throw new Error("Invalid cache key");
  const snapshot = snapshotSchema.parse(
    await rpc(client, "ai_watch_validated_cache_get_v2", {
      p_cache_key: cacheKey,
    }),
  );
  if (!snapshot) return null;
  if (
    snapshot.watches.some(
      (watch) =>
        !safeHttpUrl(watch.sourceUrl) ||
        watch.details.validationEvidence.some(
          (evidence) => !safeHttpUrl(evidence.sourceUrl),
        ),
    )
  )
    throw new Error("Invalid source URL in validated snapshot");
  return {
    ...snapshot,
    watches: snapshot.watches.map((watch) => ({
      ...watch,
      imageUrl: safeHttpUrl(watch.imageUrl),
    })),
  };
}

/** Publish validated evidence and settle the reservation in one DB transaction. */
export async function publishValidatedSnapshot(
  client: CatalogueClient,
  attemptId: string,
  watches: FoundWatch[],
  costs: readonly (number | null)[],
) {
  z.string().uuid().parse(attemptId);
  const parsed = z.array(watchSchema).min(1).max(8).parse(watches);
  const summary = `${parsed.length} ${parsed.length === 1 ? "watch" : "watches"} with checked sources.`;
  return z.boolean().parse(
    await rpc(client, "ai_watch_validated_cache_publish_v2", {
      p_attempt_id: attemptId,
      p_summary: summary,
      p_watches: parsed,
      p_costs_usd: validationCharges(costs),
    }),
  );
}

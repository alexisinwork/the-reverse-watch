import { z } from "zod";

import { rpc, type CatalogueClient } from "./watch-catalogue.server";

export const VALIDATION_WATCH_LIMIT_USD = 0.025;
export const VALIDATION_SEARCH_WATCH_LIMIT = 8;

export async function validationBudgetStatus(client: CatalogueClient) {
  return z
    .object({
      month: z.string(),
      spentUsd: z.number(),
      reservedUsd: z.number(),
      limitUsd: z.number(),
      remainingUsd: z.number(),
      halted: z.boolean(),
      attempts: z.number(),
      inProgress: z.number(),
      validated: z.number(),
      failed: z.number(),
    })
    .parse(await rpc(client, "ai_watch_validation_admin_status_v1", {}));
}

const reserveSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("reserved"),
    attemptId: z.string().uuid(),
    reservedUsd: z.number().positive().max(0.2),
  }),
  z.object({ state: z.literal("in_progress") }),
  z.object({ state: z.literal("monthly_limit") }),
  z.object({ state: z.literal("budget_halted") }),
  z.object({ state: z.literal("retry_later") }),
  z.object({ state: z.literal("valid") }),
]);

/** Reserve before any provider request. Only a non-identifying cache hash is sent. */
export async function reserveValidationBudget(
  client: CatalogueClient,
  cacheKey: string,
  watchCount: number,
) {
  if (!/^[0-9a-f]{64}$/.test(cacheKey)) throw new Error("Invalid cache key");
  if (
    !Number.isInteger(watchCount) ||
    watchCount < 1 ||
    watchCount > VALIDATION_SEARCH_WATCH_LIMIT
  )
    throw new Error("Invalid watch count");
  return reserveSchema.parse(
    await rpc(client, "ai_watch_validation_reserve_v5", {
      p_cache_key: cacheKey,
      p_watch_count: watchCount,
    }),
  );
}

/** Persist known overspend and halt future reservations; keep this attempt
 * reserved until its unknown or excess charges are reconciled. */
export async function reportValidationOverrun(
  client: CatalogueClient,
  attemptId: string,
  costs: readonly (number | null)[],
) {
  z.string().uuid().parse(attemptId);
  z.array(z.number().finite().nonnegative().max(100_000).nullable())
    .min(1)
    .max(8)
    .parse(costs);
  if (!costs.some((cost) => cost !== null && cost > VALIDATION_WATCH_LIMIT_USD))
    throw new Error("No observed overrun");
  return z.boolean().parse(
    await rpc(client, "ai_watch_validation_report_overrun_v1", {
      p_attempt_id: attemptId,
      p_costs: costs,
    }),
  );
}

/** An unknown provider cost must be conservatively settled at the full per-watch
 * reservation; callers must never replace a timeout with a guessed zero cost. */
export async function settleValidationBudget(
  client: CatalogueClient,
  attemptId: string,
  costs: readonly (number | null)[],
) {
  if (
    !z.string().uuid().safeParse(attemptId).success ||
    costs.length < 1 ||
    costs.length > VALIDATION_SEARCH_WATCH_LIMIT
  )
    throw new Error("Invalid settlement");
  const charges = validationCharges(costs);
  return z.boolean().parse(
    await rpc(client, "ai_watch_validation_settle_v2", {
      p_attempt_id: attemptId,
      p_costs_usd: charges,
    }),
  );
}

/** Convert unknown costs to the reservation ceiling rather than zero. */
export function validationCharges(costs: readonly (number | null)[]) {
  if (costs.length < 1 || costs.length > VALIDATION_SEARCH_WATCH_LIMIT)
    throw new Error("Invalid settlement");
  return costs.map((cost) => {
    if (cost === null) return VALIDATION_WATCH_LIMIT_USD;
    if (!Number.isFinite(cost) || cost < 0 || cost > VALIDATION_WATCH_LIMIT_USD)
      throw new Error("Invalid watch cost");
    // The DB ledger keeps five fractional digits. Round upward per card
    // before serialization so binary floating point never understates a bill.
    return Math.ceil(cost * 100_000) / 100_000;
  });
}

import { z } from "zod";
import type { FoundWatch } from "./ai-watch-types";
import type { CatalogueWatch } from "./watch-catalogue";
import { catalogueWatchSchema, catalogueToFoundWatch } from "./watch-catalogue";
import type { Deps } from "./ai-providers.server";
import { normalizeReference } from "./ai-watch-guardrails";
import { checkedWatchSchema } from "./validated-cache.server";
import { parseObservedPrice } from "./validated-price";
import { validationServices } from "./validation-services.server";
import { checkWatchWithProviders } from "./validate-one-watch.server";
import {
  validationCharges,
  reportValidationOverrun,
} from "./validation-budget.server";
import {
  rpc,
  clearCatalogueCache,
  type CatalogueClient,
} from "./watch-catalogue.server";

export const priceRefreshReservationSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("reserved"),
    attemptId: z.string().uuid(),
    watches: z.array(catalogueWatchSchema).min(1).max(8),
  }),
  z.object({
    state: z.enum([
      "no_due",
      "already_run",
      "in_progress",
      "monthly_limit",
      "budget_halted",
      "retry_later",
      "valid",
    ]),
  }),
]);
export type PriceRefreshReservation = z.infer<
  typeof priceRefreshReservationSchema
>;
export type RefreshedPrice = {
  id: string;
  amount: number;
  currency: string;
  priceStatus: "confirmed" | "approximate";
  evidence: Record<string, unknown>;
};

/** Unlike a flexible visitor estimate, scheduled refresh requires agreement
 * in one currency. A market observation never silently becomes a retail price. */
export function refreshedPrice(
  watch: CatalogueWatch,
  candidate: FoundWatch,
): RefreshedPrice | null {
  if (
    normalizeReference(watch.brand) !== normalizeReference(candidate.brand) ||
    normalizeReference(watch.referenceCode) !==
      normalizeReference(candidate.referenceCode)
  )
    return null;
  const checked = checkedWatchSchema.safeParse(candidate);
  if (!checked.success) return null;
  const observation = checked.data.details.priceObservation;
  if (!observation) return null;
  const first = parseObservedPrice(
    observation.sources.find((s) => s.provider === "perplexity")!.value,
  );
  const second = parseObservedPrice(
    observation.sources.find((s) => s.provider === "muse")!.value,
  );
  if (
    !first ||
    !second ||
    first.currency !== second.currency ||
    Math.abs(first.amount - second.amount) /
      Math.max(first.amount, second.amount) >
      0.05
  )
    return null;
  return {
    id: watch.id,
    amount: first.amount,
    currency: first.currency,
    // This lightweight check verifies an estimate, not retail authorization.
    // Even an MSRP-looking quote retains the owner's approximate-price label.
    priceStatus: "approximate",
    evidence: {
      policy: "metered-price-v1",
      priceObservation: observation,
      validationEvidence: checked.data.details.validationEvidence,
    },
  };
}

type Check = Awaited<ReturnType<typeof checkWatchWithProviders>>;
export type PriceRefreshServices = {
  reserve: () => Promise<PriceRefreshReservation>;
  check: (watch: CatalogueWatch) => Promise<Check>;
  finish: (
    id: string,
    prices: RefreshedPrice[],
    costs: (number | null)[],
  ) => Promise<boolean>;
  overrun: (id: string, costs: (number | null)[]) => Promise<boolean>;
};

export function priceRefreshServices(
  client: CatalogueClient,
  deps: Deps,
): PriceRefreshServices {
  const validation = validationServices(client, deps);
  return {
    reserve: async () =>
      priceRefreshReservationSchema.parse(
        await rpc(client, "catalogue_price_recheck_reserve_v1", {}),
      ),
    check: async (watch) => {
      const card = catalogueToFoundWatch(watch);
      if (!card) return { decision: null, cost: 0 };
      // Retain local identity/specs; the old amount must not masquerade as a
      // fresh price. Only the requested price crosses the provider boundary.
      return checkWatchWithProviders(
        {
          ...card,
          priceNote: null,
          details: {
            ...card.details,
            price: null,
            priceObservation: undefined,
          },
        },
        validation,
        ["price"],
      );
    },
    finish: async (id, prices, costs) => {
      const result = z.boolean().parse(
        await rpc(client, "catalogue_price_recheck_finish_v1", {
          p_attempt_id: id,
          p_results: prices,
          p_costs_usd: validationCharges(costs),
        }),
      );
      if (result) clearCatalogueCache();
      return result;
    },
    overrun: (id, costs) => reportValidationOverrun(client, id, costs),
  };
}

/** Admission is atomic and precedes every paid request. No implicit provider
 * retries, catalogue writes or standalone settlements escape this path. */
export async function runPriceRefresh(services: PriceRefreshServices) {
  const reservation = await services.reserve();
  if (reservation.state !== "reserved")
    return { ok: true, skipped: true, reason: reservation.state };
  const results = await Promise.all(
    reservation.watches.map((watch) =>
      services.check(watch).catch(() => ({ decision: null, cost: null })),
    ),
  );
  const costs = results.map((r) => r.cost);
  if (results.some((r) => "overrun" in r && r.overrun)) {
    await services.overrun(reservation.attemptId, costs);
    return { ok: false, reason: "budget_halted" };
  }
  const prices = results.flatMap((result, index) => {
    if (result.decision?.status !== "verified") return [];
    const price = refreshedPrice(
      reservation.watches[index]!,
      result.decision.watch,
    );
    return price ? [price] : [];
  });
  const finished = await services.finish(reservation.attemptId, prices, costs);
  return finished
    ? { ok: true, checked: results.length, verifiedPrices: prices.length }
    : { ok: false, reason: "settlement_failed" };
}

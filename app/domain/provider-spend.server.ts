// What each paid provider cost this month, kept beside the spend ledger so
// the owner can see the Perplexity share before its prepaid balance runs out
// (owner, 2026-11-26: "в перплексити просто хочу знать заранее"). The
// ledger stays the authority on what may be spent; this is a best-effort
// counter in Upstash Redis that never blocks or fails a paid call.
import { Redis } from "@upstash/redis";

export type Provider = "perplexity" | "muse";
export const PROVIDERS: readonly Provider[] = ["perplexity", "muse"];

/** UTC calendar month, the same month the ledger uses. */
export const spendMonth = (at = new Date()) => at.toISOString().slice(0, 7);
const key = (month: string, provider: Provider) =>
  `the-reserve:provider-spend:${month}:${provider}`;
const KEEP_SECONDS = 70 * 24 * 60 * 60;

let client: Redis | null | undefined;
function redis() {
  if (client !== undefined) return client;
  const url = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const token = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();
  client = url && token ? new Redis({ url, token }) : null;
  return client;
}

/** Add one call's charge. Errors are swallowed: counting must never stop a
 * paid check that has already been reserved and made. */
export async function recordProviderSpend(
  provider: Provider,
  costUsd: number | null,
  at = new Date(),
) {
  if (costUsd === null || !Number.isFinite(costUsd) || costUsd <= 0) return;
  const store = redis();
  if (!store) return;
  try {
    const counter = key(spendMonth(at), provider);
    await store.incrbyfloat(counter, costUsd);
    await store.expire(counter, KEEP_SECONDS);
  } catch {
    // The ledger still holds the authoritative total.
  }
}

/** This month's charge per provider; null where the counter is unavailable. */
export async function providerSpendThisMonth(at = new Date()) {
  const store = redis();
  const month = spendMonth(at);
  const result: Record<Provider, number | null> = {
    perplexity: null,
    muse: null,
  };
  if (!store) return result;
  for (const provider of PROVIDERS) {
    try {
      const value = await store.get<string | number>(key(month, provider));
      result[provider] = value === null ? 0 : Number(value);
    } catch {
      result[provider] = null;
    }
  }
  return result;
}

/** Test seam: forget the cached client so a test can change the settings. */
export function resetProviderSpendClient() {
  client = undefined;
}

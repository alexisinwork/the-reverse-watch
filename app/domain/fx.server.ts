import type { FxTable } from "./fx";

export { convert, supportedCurrencies, type FxTable } from "./fx";

/**
 * Official European Central Bank daily reference rates: about 30 major
 * currencies, published around 16:00 CET on TARGET working days. Rates are
 * quoted as units of each currency per 1 EUR.
 */
export const ECB_DAILY_URL =
  "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

export function parseEcbDailyXml(xml: string): FxTable {
  const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]/)?.[1];
  if (!date) throw new Error("ECB feed has no reference date.");
  const perEur: Record<string, number> = { EUR: 1 };
  for (const match of xml.matchAll(
    /<Cube\s+currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g,
  )) {
    const rate = Number(match[2]);
    if (Number.isFinite(rate) && rate > 0) perEur[match[1]!] = rate;
  }
  if (Object.keys(perEur).length < 10) {
    throw new Error("ECB feed contained too few rates.");
  }
  return { date, perEur };
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cached: { table: FxTable; expiresAt: number } | null = null;

export async function loadFxTable(
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): Promise<FxTable | null> {
  if (cached && cached.expiresAt > now()) return cached.table;
  try {
    const response = await fetchImpl(ECB_DAILY_URL, {
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) throw new Error(`ECB feed returned ${response.status}.`);
    const table = parseEcbDailyXml(await response.text());
    cached = { table, expiresAt: now() + CACHE_TTL_MS };
    return table;
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "fx_rates_unavailable",
        message: error instanceof Error ? error.message : "unknown error",
      }),
    );
    // A stale table still beats no conversion at all.
    return cached?.table ?? null;
  }
}

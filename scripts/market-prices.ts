// Gives every catalogue watch without any price an approximate market price
// from new, unworn or like-new listings (Chrono24 or other dealers), so
// visitors get a price range. Confirmed retail prices are never touched.
// Stops starting new lookups at --budget (USD, default 40).
//   node --env-file=.env --import tsx scripts/market-prices.ts [--budget 40] [--concurrency 6]
import { defaultDeps } from "../app/domain/ai-providers.server";
import { proposedUsd } from "../app/domain/catalogue-build.server";
import { loadFxTable } from "../app/domain/fx.server";
import { lookupMarketPrice } from "../app/domain/market-price.server";
import {
  catalogueClient,
  listCatalogue,
  recordCataloguePrice,
} from "../app/domain/watch-catalogue.server";

function flag(name: string, fallback: number) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
const budget = flag("budget", 40);
const concurrency = flag("concurrency", 6);

// Rough list-price cost: Sonar with medium context, Muse web research.
const calls = { perplexity: 0, muse: 0 };
const spend = () => calls.perplexity * 0.01 + calls.muse * 0.05;
const countingFetch: typeof fetch = (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url.startsWith("https://api.perplexity.ai")) calls.perplexity += 1;
  else if (url.includes("api.meta.ai")) calls.muse += 1;
  return fetch(input, init);
};

const client = catalogueClient();
if (!client) throw new Error("Supabase service key required.");
const deps = defaultDeps({ fetchImpl: countingFetch });
const fx = await loadFxTable();
const watches = (await listCatalogue(client)).filter(
  (watch) => watch.priceStatus === "unconfirmed",
);
console.log(`${watches.length} watches without any price.`);

const counts: Record<string, number> = {};
const queue = [...watches];
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    for (let watch = queue.shift(); watch; watch = queue.shift()) {
      if (spend() >= budget) {
        counts.skipped_budget = (counts.skipped_budget ?? 0) + 1;
        continue;
      }
      try {
        const market = await lookupMarketPrice(
          watch,
          deps,
          fx,
          proposedUsd(watch, fx),
        );
        if (market.status === "found") {
          await recordCataloguePrice(client, watch.id, {
            kind: "approximate",
            amount: market.amount,
            currency: market.currency,
            evidence: market.evidence,
          });
          counts.found = (counts.found ?? 0) + 1;
        } else {
          const reason = String(market.evidence.reason);
          counts[reason] = (counts[reason] ?? 0) + 1;
        }
        console.log(
          `$${spend().toFixed(2)} ${market.status === "found" ? `USD ${market.amount}`.padEnd(11) : "none".padEnd(11)} ${watch.brand} ${watch.model} ${watch.referenceCode ?? ""}`,
        );
      } catch (error) {
        counts.error = (counts.error ?? 0) + 1;
        console.error(
          `error ${watch.brand} ${watch.model}: ${error instanceof Error ? error.message.slice(0, 120) : "unknown"}`,
        );
      }
    }
  }),
);
console.log(
  `\nDone: ${JSON.stringify(counts)}; estimated spend USD ${spend().toFixed(2)}`,
);

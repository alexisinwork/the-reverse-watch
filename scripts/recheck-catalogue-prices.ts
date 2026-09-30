// Rechecks catalogue prices locally with the same double check the daily
// cron uses (Perplexity finds, Muse Spark checks, Perplexity as fallback).
//   Default:            every price older than 90 days or never checked.
//   --unconfirmed:      every watch whose price is not yet confirmed.
//   --reference-confirmed: only watches whose reference is confirmed
//                       (the ones that can become main picks).
//   --budget 25:        stop starting new checks at this estimated spend (USD).
//   node --env-file=.env --import tsx scripts/recheck-catalogue-prices.ts [--unconfirmed] [--reference-confirmed] [--budget 25] [--concurrency 4]
import { defaultDeps, searchReady } from "../app/domain/ai-providers.server";
import { recheckPrice } from "../app/domain/catalogue-build.server";
import { loadFxTable } from "../app/domain/fx.server";
import { PRICE_MAX_AGE_DAYS } from "../app/domain/price-check.server";
import {
  catalogueClient,
  cataloguePricesDue,
  listCatalogue,
  recordCataloguePrice,
} from "../app/domain/watch-catalogue.server";

function flag(name: string, fallback: number) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index >= 0 ? Number(process.argv[index + 1]) : Number.NaN;
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
const concurrency = flag("concurrency", 4);
const budget = flag("budget", Number.POSITIVE_INFINITY);

// Rough list-price cost per provider call, as in build-catalogue.ts.
const calls = { perplexity: 0, muse: 0 };
const spend = () => calls.perplexity * 0.0075 + calls.muse * 0.05;
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
const deps = defaultDeps({ fetchImpl: countingFetch });
if (!client || !searchReady(deps.config)) {
  throw new Error("Supabase service key and PERPLEXITY_API_KEY are required.");
}
const fx = await loadFxTable();
let watches = process.argv.includes("--unconfirmed")
  ? (await listCatalogue(client)).filter(
      (watch) => watch.priceStatus !== "confirmed",
    )
  : await cataloguePricesDue(
      client,
      new Date(Date.now() - PRICE_MAX_AGE_DAYS * 86_400_000),
      200,
    );
if (process.argv.includes("--reference-confirmed")) {
  watches = watches.filter((watch) => watch.referenceConfirmed);
}
console.log(`${watches.length} prices to check.`);

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
        const result = await recheckPrice(watch, deps, fx);
        await recordCataloguePrice(client, watch.id, result);
        counts[result.kind] = (counts[result.kind] ?? 0) + 1;
        console.log(
          `$${spend().toFixed(2)} ${result.kind.padEnd(11)} ${watch.brand} ${watch.model} ${watch.referenceCode ?? ""}`,
        );
      } catch (error) {
        counts.error = (counts.error ?? 0) + 1;
        console.error(
          `error       ${watch.brand} ${watch.model}: ${error instanceof Error ? error.message.slice(0, 120) : "unknown"}`,
        );
      }
    }
  }),
);
console.log(
  `\nDone: ${JSON.stringify(counts)}; estimated spend USD ${spend().toFixed(2)}`,
);

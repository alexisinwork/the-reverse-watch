// Rechecks catalogue prices locally with the same double Perplexity check
// the daily cron uses. By default: every price older than 90 days or never
// checked. --unconfirmed: every watch whose price is not yet confirmed.
//   node --env-file=.env --import tsx scripts/recheck-catalogue-prices.ts [--unconfirmed] [--concurrency 4]
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

const index = process.argv.indexOf("--concurrency");
const concurrency = index >= 0 ? Number(process.argv[index + 1]) || 4 : 4;
const client = catalogueClient();
const deps = defaultDeps();
if (!client || !searchReady(deps.config)) {
  throw new Error("Supabase service key and PERPLEXITY_API_KEY are required.");
}
const fx = await loadFxTable();
const watches = process.argv.includes("--unconfirmed")
  ? (await listCatalogue(client)).filter(
      (watch) => watch.priceStatus !== "confirmed",
    )
  : await cataloguePricesDue(
      client,
      new Date(Date.now() - PRICE_MAX_AGE_DAYS * 86_400_000),
      200,
    );
console.log(`${watches.length} prices to check.`);

const counts: Record<string, number> = {};
const queue = [...watches];
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    for (let watch = queue.shift(); watch; watch = queue.shift()) {
      try {
        const result = await recheckPrice(watch, deps, fx);
        await recordCataloguePrice(client, watch.id, result);
        counts[result.kind] = (counts[result.kind] ?? 0) + 1;
        console.log(
          `${result.kind.padEnd(11)} ${watch.brand} ${watch.model} ${watch.referenceCode ?? ""}`,
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
console.log(`\nDone: ${JSON.stringify(counts)}`);

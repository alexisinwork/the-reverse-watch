// One-off pass: for every watch with a confirmed reference but no confirmed
// price, let Muse Spark search the web for the price. The Perplexity
// lookups already stored for the watch are reused as partners, so
// Perplexity is not queried again. Stops at --budget (USD, default 20).
//   node --env-file=.env --import tsx scripts/muse-price-pass.ts [--concurrency 4] [--budget 20]
import { defaultDeps, searchReady } from "../app/domain/ai-providers.server";
import { loadFxTable } from "../app/domain/fx.server";
import {
  doublePriceCheck,
  type PriceCheck,
  type PriceLookup,
} from "../app/domain/price-check.server";
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
const concurrency = flag("concurrency", 4);
const budget = flag("budget", 20);

// Rough cost per call, as in build-catalogue.ts.
const calls = { muse: 0, search: 0, chat: 0 };
const spend = () =>
  calls.muse * 0.006 + calls.search * 0.005 + calls.chat * 0.0075;
const countingFetch: typeof fetch = (input, init) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url;
  if (url.includes("api.meta.ai")) calls.muse += 1;
  else if (url.startsWith("https://api.perplexity.ai/search"))
    calls.search += 1;
  else if (url.startsWith("https://api.perplexity.ai/chat")) calls.chat += 1;
  return fetch(input, init);
};

const client = catalogueClient();
const deps = defaultDeps({ fetchImpl: countingFetch });
if (!client || !searchReady(deps.config)) {
  throw new Error(
    "Supabase service key, MUSE_SPARK_API_KEY and PERPLEXITY_API_KEY are required.",
  );
}
const fx = await loadFxTable();
const watches = (await listCatalogue(client)).filter(
  (watch) => watch.referenceConfirmed && watch.priceStatus !== "confirmed",
);
console.log(
  `${watches.length} watches with a confirmed reference and no confirmed price.`,
);

const counts: Record<string, number> = {};
const queue = [...watches];
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    for (let watch = queue.shift(); watch; watch = queue.shift()) {
      if (spend() >= budget) {
        counts.skipped_budget = (counts.skipped_budget ?? 0) + 1;
        continue;
      }
      const stored = watch.priceEvidence as {
        lookups?: unknown;
        checkedAt?: unknown;
      };
      const previous: PriceCheck = {
        status: "unconfirmed",
        evidence: {
          method: "double_perplexity",
          checkedAt:
            typeof stored.checkedAt === "string" ? stored.checkedAt : null,
          lookups: Array.isArray(stored.lookups)
            ? ((stored.lookups as unknown[]).filter(
                Array.isArray,
              ) as PriceLookup[][])
            : [],
        },
        imageUrls: [],
      };
      try {
        const check = await doublePriceCheck(watch, deps, fx, watch.sourceUrl, {
          museFallback: true,
          previous,
        });
        if (check.status === "confirmed") {
          await recordCataloguePrice(client, watch.id, {
            kind: "confirmed",
            amount: check.amount,
            currency: check.currency,
            evidence: check.evidence,
          });
        }
        counts[check.status] = (counts[check.status] ?? 0) + 1;
        console.log(
          `$${spend().toFixed(2)} ${check.status.padEnd(11)} ${watch.brand} ${watch.model} ${watch.referenceCode ?? ""}${check.status === "confirmed" ? ` -> ${check.currency} ${check.amount}` : ""}`,
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
  `\nDone: ${JSON.stringify(counts)}; calls ${JSON.stringify(calls)}; estimated spend USD ${spend().toFixed(2)}`,
);

// Runs the same searches through Perplexity and through Muse Spark's
// built-in web search (WEB_SEARCH_PROVIDER), and writes a side-by-side
// report of quality, speed and cost. Nothing is written to the catalogue.
//   node --env-file=.env --import tsx scripts/compare-search-providers.ts
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";

import {
  defaultDeps,
  type Deps,
  type WebSearchProvider,
} from "../app/domain/ai-providers.server";
import { searchFilmWatches } from "../app/domain/film-search.server";
import { loadFxTable } from "../app/domain/fx.server";
import { doublePriceCheck } from "../app/domain/price-check.server";
import type { ProfileV4 } from "../app/domain/questionnaire-v4";
import { searchQuizWatches } from "../app/domain/quiz-live-search.server";
import {
  catalogueClient,
  listCatalogue,
} from "../app/domain/watch-catalogue.server";

const PROVIDERS: WebSearchProvider[] = ["perplexity", "muse"];

// ---------------------------------------------------------------------------
// Cost meter: list prices, read from each response's own usage figures.
//   Muse Spark: $1.25/M input, $0.15/M cached input, $4.25/M output,
//               $2.50 per 1,000 web searches or page opens.
//   Perplexity: Sonar usage.cost when reported (else ~$0.006 per call),
//               Search API $0.005 per request.

type Meter = {
  usd: number;
  museCalls: number;
  museTools: number;
  perplexityCalls: number;
};

function meteredDeps(provider: WebSearchProvider, meter: Meter): Deps {
  const base = defaultDeps();
  const fetchImpl: typeof fetch = async (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const response = await fetch(input, init);
    if (url.includes("api.meta.ai")) {
      meter.museCalls += 1;
      const body = (await response
        .clone()
        .json()
        .catch(() => ({}))) as {
        usage?: Record<string, unknown>;
        output?: { type?: string }[];
      };
      const usage = body.usage ?? {};
      const input = Number(usage.input_tokens ?? usage.prompt_tokens ?? 0) || 0;
      const cachedDetails = (usage.input_tokens_details ??
        usage.prompt_tokens_details ??
        {}) as { cached_tokens?: number };
      const cached = Number(cachedDetails.cached_tokens ?? 0) || 0;
      const output =
        Number(usage.output_tokens ?? usage.completion_tokens ?? 0) || 0;
      const tools = (body.output ?? []).filter(
        (item) => item.type === "web_search_call",
      ).length;
      meter.museTools += tools;
      meter.usd +=
        ((input - cached) * 1.25 + cached * 0.15 + output * 4.25) / 1_000_000 +
        tools * 0.0025;
    } else if (url.startsWith("https://api.perplexity.ai/search")) {
      meter.perplexityCalls += 1;
      meter.usd += 0.005;
    } else if (url.startsWith("https://api.perplexity.ai")) {
      meter.perplexityCalls += 1;
      const body = (await response
        .clone()
        .json()
        .catch(() => ({}))) as {
        usage?: { cost?: { total_cost?: number } };
      };
      meter.usd += body.usage?.cost?.total_cost ?? 0.006;
    }
    return response;
  };
  return {
    ...base,
    fetchImpl,
    config: { ...base.config, webSearch: provider },
  };
}

function newMeter(): Meter {
  return { usd: 0, museCalls: 0, museTools: 0, perplexityCalls: 0 };
}

async function timed<T>(run: () => Promise<T>) {
  const started = performance.now();
  const value = await run();
  return {
    value,
    seconds: Math.round((performance.now() - started) / 100) / 10,
  };
}

async function pool<T>(
  items: T[],
  size: number,
  work: (item: T) => Promise<void>,
) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: size }, async () => {
      for (let item = queue.shift(); item !== undefined; item = queue.shift())
        await work(item);
    }),
  );
}

// ---------------------------------------------------------------------------

const client = catalogueClient();
if (!client) throw new Error("Supabase service key required.");
const fx = await loadFxTable();
const catalogue = await listCatalogue(client);

// Prices: 10 watches whose price is already confirmed (to check accuracy)
// and 10 with a confirmed reference but no confirmed price (to check
// coverage), spread across brands.
function spread<T extends { brand: string }>(items: T[], count: number) {
  const seen = new Set<string>();
  const picked: T[] = [];
  for (const item of items) {
    if (seen.has(item.brand)) continue;
    seen.add(item.brand);
    picked.push(item);
    if (picked.length === count) break;
  }
  return picked;
}
const known = spread(
  catalogue.filter(
    (watch) => watch.referenceConfirmed && watch.priceStatus === "confirmed",
  ),
  10,
);
const unknown = spread(
  catalogue.filter(
    (watch) => watch.referenceConfirmed && watch.priceStatus !== "confirmed",
  ),
  10,
);

type PriceRow = {
  watch: string;
  stored: string | null;
  results: Record<
    WebSearchProvider,
    {
      status: string;
      price: string | null;
      agrees: boolean | null;
      seconds: number;
    }
  >;
};
const priceRows: PriceRow[] = [];
const priceCost: Record<string, Meter> = {};
for (const provider of PROVIDERS) {
  const meter = newMeter();
  priceCost[provider] = meter;
  const deps = meteredDeps(provider, meter);
  await pool([...known, ...unknown], 4, async (watch) => {
    const { value: check, seconds } = await timed(() =>
      doublePriceCheck(watch, deps, fx, watch.sourceUrl),
    );
    const name =
      `${watch.brand} ${watch.model} ${watch.referenceCode ?? ""}`.trim();
    let row = priceRows.find((entry) => entry.watch === name);
    if (!row) {
      row = {
        watch: name,
        stored:
          watch.priceStatus === "confirmed" && watch.priceAmount !== null
            ? `${watch.priceCurrency} ${watch.priceAmount}`
            : null,
        results: {} as PriceRow["results"],
      };
      priceRows.push(row);
    }
    const agrees =
      check.status === "confirmed" &&
      watch.priceStatus === "confirmed" &&
      watch.priceAmount
        ? check.currency === watch.priceCurrency &&
          Math.abs(check.amount - watch.priceAmount) / watch.priceAmount <= 0.05
        : null;
    row.results[provider] = {
      status: check.status,
      price:
        check.status === "confirmed"
          ? `${check.currency} ${check.amount}`
          : null,
      agrees,
      seconds,
    };
    console.log(
      `price ${provider.padEnd(10)} ${check.status.padEnd(11)} ${seconds}s ${name}`,
    );
  });
}

// Film and people search.
const FILM_SUBJECTS = ["Heat", "Severance", "Roger Federer", "Daniel Craig"];
type FilmRow = {
  subject: string;
  results: Record<
    string,
    {
      status: string;
      watches: number;
      photos: number;
      seconds: number;
      names: string;
    }
  >;
};
const filmRows: FilmRow[] = FILM_SUBJECTS.map((subject) => ({
  subject,
  results: {},
}));
const filmCost: Record<string, Meter> = {};
for (const provider of PROVIDERS) {
  const meter = newMeter();
  filmCost[provider] = meter;
  const deps = meteredDeps(provider, meter);
  for (const row of filmRows) {
    const { value, seconds } = await timed(() =>
      searchFilmWatches(row.subject, deps).catch(() => ({
        status: "unavailable" as const,
      })),
    );
    const watches = value.status === "found" ? value.watches : [];
    row.results[provider] = {
      status: value.status,
      watches: watches.length,
      photos: watches.filter((watch) => watch.imageUrl).length,
      seconds,
      names: watches
        .slice(0, 5)
        .map((watch) => `${watch.brand} ${watch.model}`)
        .join("; "),
    };
    console.log(
      `film  ${provider.padEnd(10)} ${value.status.padEnd(11)} ${seconds}s ${row.subject}`,
    );
  }
}

// Quiz live search (the path used above 10k or for catalogue gaps).
const base: ProfileV4 = {
  version: 4,
  budgetCurrency: "USD",
  priceRange: "15000_20000",
  wristCm: 17.5,
  wearingScenarios: ["suit"],
  minimumWaterResistanceM: 0,
  movementTypes: ["automatic", "manual"],
  requiredComplications: [],
  allergyConstraint: "none",
};
const QUIZ_CASES: { label: string; profile: ProfileV4 }[] = [
  { label: "USD 15k–20k, dress, 17.5 cm", profile: base },
  {
    label: "USD 9k–10k, dive, 300 m",
    profile: {
      ...base,
      priceRange: "9000_10000",
      wearingScenarios: ["diving"],
      minimumWaterResistanceM: 300,
    },
  },
];
type QuizRow = {
  label: string;
  results: Record<
    string,
    { status: string; watches: number; seconds: number; names: string }
  >;
};
const quizRows: QuizRow[] = QUIZ_CASES.map((test) => ({
  label: test.label,
  results: {},
}));
const quizCost: Record<string, Meter> = {};
for (const provider of PROVIDERS) {
  const meter = newMeter();
  quizCost[provider] = meter;
  const deps = meteredDeps(provider, meter);
  for (const [index, test] of QUIZ_CASES.entries()) {
    const { value, seconds } = await timed(() =>
      searchQuizWatches(test.profile, deps),
    );
    const watches = value.status === "found" ? value.watches : [];
    quizRows[index]!.results[provider] = {
      status: value.status,
      watches: watches.length,
      seconds,
      names: watches.map((watch) => `${watch.brand} ${watch.model}`).join("; "),
    };
    console.log(
      `quiz  ${provider.padEnd(10)} ${value.status.padEnd(11)} ${seconds}s ${test.label}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Report

const usd = (meter: Meter | undefined) => `$${(meter?.usd ?? 0).toFixed(2)}`;
const avg = (values: number[]) =>
  values.length === 0
    ? 0
    : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
const lines: string[] = [];
const push = (...values: string[]) => lines.push(...values);
const today = new Date().toISOString().slice(0, 10);

push(
  `# Search providers compared: Perplexity vs Muse Spark web search`,
  "",
  `Run ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC. Costs are list prices computed from each response's own usage figures.`,
  "",
);
push("## Summary", "", "| | Perplexity | Muse Spark only |", "|---|---:|---:|");
for (const [label, rows, cost] of [
  ["Price checks", priceRows.length, priceCost],
  ["Film searches", filmRows.length, filmCost],
  ["Quiz live searches", quizRows.length, quizCost],
] as const) {
  push(
    `| ${label} (${rows}) cost | ${usd(cost.perplexity)} | ${usd(cost.muse)} |`,
  );
}
const confirmed = (provider: WebSearchProvider, rows: PriceRow[]) =>
  rows.filter((row) => row.results[provider]?.status === "confirmed").length;
const knownRows = priceRows.filter((row) => row.stored !== null);
const unknownRows = priceRows.filter((row) => row.stored === null);
push(
  `| Prices re-confirmed, of ${knownRows.length} already known | ${confirmed("perplexity", knownRows)} | ${confirmed("muse", knownRows)} |`,
  `| …of those, agreeing with the stored price (±5%) | ${knownRows.filter((row) => row.results.perplexity?.agrees).length} | ${knownRows.filter((row) => row.results.muse?.agrees).length} |`,
  `| New prices confirmed, of ${unknownRows.length} unknown | ${confirmed("perplexity", unknownRows)} | ${confirmed("muse", unknownRows)} |`,
  `| Average seconds per price check | ${avg(priceRows.map((row) => row.results.perplexity?.seconds ?? 0))} | ${avg(priceRows.map((row) => row.results.muse?.seconds ?? 0))} |`,
  `| Film: watches found (photos) | ${filmRows.reduce((a, row) => a + (row.results.perplexity?.watches ?? 0), 0)} (${filmRows.reduce((a, row) => a + (row.results.perplexity?.photos ?? 0), 0)}) | ${filmRows.reduce((a, row) => a + (row.results.muse?.watches ?? 0), 0)} (${filmRows.reduce((a, row) => a + (row.results.muse?.photos ?? 0), 0)}) |`,
  `| Film: average seconds | ${avg(filmRows.map((row) => row.results.perplexity?.seconds ?? 0))} | ${avg(filmRows.map((row) => row.results.muse?.seconds ?? 0))} |`,
  `| Quiz live: watches found | ${quizRows.reduce((a, row) => a + (row.results.perplexity?.watches ?? 0), 0)} | ${quizRows.reduce((a, row) => a + (row.results.muse?.watches ?? 0), 0)} |`,
  `| Quiz live: average seconds | ${avg(quizRows.map((row) => row.results.perplexity?.seconds ?? 0))} | ${avg(quizRows.map((row) => row.results.muse?.seconds ?? 0))} |`,
  "",
);
push(
  "## Price checks",
  "",
  "| Watch | Stored price | Perplexity | Muse Spark |",
  "|---|---|---|---|",
);
for (const row of priceRows) {
  const cell = (provider: WebSearchProvider) => {
    const result = row.results[provider];
    if (!result) return "—";
    return `${result.price ?? result.status}${result.agrees === false ? " ✗" : result.agrees ? " ✓" : ""} (${result.seconds} s)`;
  };
  push(
    `| ${row.watch} | ${row.stored ?? "—"} | ${cell("perplexity")} | ${cell("muse")} |`,
  );
}
push(
  "",
  "## Film and people search",
  "",
  "| Subject | Perplexity | Muse Spark |",
  "|---|---|---|",
);
for (const row of filmRows) {
  const cell = (provider: string) => {
    const result = row.results[provider];
    return result
      ? `${result.watches} watches, ${result.photos} photos, ${result.seconds} s: ${result.names}`
      : "—";
  };
  push(`| ${row.subject} | ${cell("perplexity")} | ${cell("muse")} |`);
}
push(
  "",
  "## Quiz live search",
  "",
  "| Profile | Perplexity | Muse Spark |",
  "|---|---|---|",
);
for (const row of quizRows) {
  const cell = (provider: string) => {
    const result = row.results[provider];
    return result
      ? `${result.watches} watches, ${result.seconds} s: ${result.names || result.status}`
      : "—";
  };
  push(`| ${row.label} | ${cell("perplexity")} | ${cell("muse")} |`);
}
push(
  "",
  "## Calls",
  "",
  `- Perplexity run: ${Object.values({ priceCost, filmCost, quizCost })
    .map((cost) => cost.perplexity?.perplexityCalls ?? 0)
    .reduce(
      (a, b) => a + b,
      0,
    )} Perplexity calls plus Muse ranking/proposal calls.`,
  `- Muse run: ${Object.values({ priceCost, filmCost, quizCost })
    .map((cost) => cost.muse?.museCalls ?? 0)
    .reduce((a, b) => a + b, 0)} Muse calls with ${Object.values({
    priceCost,
    filmCost,
    quizCost,
  })
    .map((cost) => cost.muse?.museTools ?? 0)
    .reduce(
      (a, b) => a + b,
      0,
    )} web searches or page opens, and ${Object.values({
    priceCost,
    filmCost,
    quizCost,
  })
    .map((cost) => cost.muse?.perplexityCalls ?? 0)
    .reduce((a, b) => a + b, 0)} Perplexity calls.`,
  "",
);

mkdirSync("docs/reports", { recursive: true });
const file = `docs/reports/search-provider-comparison-${today}.md`;
writeFileSync(file, lines.join("\n"));
copyFileSync(
  file,
  `C:/Users/alexi/OneDrive/Desktop/TheReserve_search-provider-comparison_${today}.md`,
);
console.log(`Wrote ${file} and copied it to the Desktop.`);

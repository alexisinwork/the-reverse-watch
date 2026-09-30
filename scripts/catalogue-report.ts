// Writes the catalogue report (.md): the build run, quiz test runs against
// the catalogue, the film/people search retest, and every catalogue watch
// with its wrist fit, price range and style. Copies it to the Desktop.
//   node --env-file=.env --import tsx scripts/catalogue-report.ts
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import type { AiSearchView } from "../app/domain/ai-watch-types";
import { loadFxTable } from "../app/domain/fx.server";
import {
  PRICE_RANGES,
  priceRangeLabel,
  type ProfileV4,
} from "../app/domain/questionnaire-v4";
import { searchQuiz } from "../app/domain/quiz-search.server";
import {
  CATALOGUE_MAX_PRICE,
  CATALOGUE_STYLES,
  priceIn,
  STYLE_LABELS,
  wristFitLabel,
  type CatalogueWatch,
} from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
} from "../app/domain/watch-catalogue.server";

const DESKTOP = "C:/Users/alexi/OneDrive/Desktop";
const today = new Date().toISOString().slice(0, 10);
const client = catalogueClient();
if (!client) throw new Error("Supabase service key required.");
const fx = await loadFxTable();
const all = await listCatalogue(client, true);
const live = all.filter((watch) => watch.reviewStatus !== "rejected");

const esc = (value: string | number | null | undefined) =>
  value === null || value === undefined || value === ""
    ? "—"
    : String(value).replace(/\|/g, "\\|");
const pct = (part: number, whole: number) =>
  whole === 0 ? "0%" : `${Math.round((part / whole) * 100)}%`;

const ranges = PRICE_RANGES.filter(
  (range) => range.maximum !== null && range.maximum <= CATALOGUE_MAX_PRICE,
);
function usdRange(watch: CatalogueWatch) {
  const usd = priceIn(watch, "USD", fx);
  if (usd === null) return null;
  return (
    PRICE_RANGES.find(
      (range) =>
        usd >= range.minimum && (range.maximum === null || usd < range.maximum),
    ) ?? null
  );
}
function foundRanges(watch: CatalogueWatch) {
  return [
    ...new Set(
      watch.foundIn
        .map(
          (entry) =>
            (entry as { range?: string; priceRange?: string }).range ??
            (entry as { priceRange?: string }).priceRange,
        )
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
}

// --- Build run -------------------------------------------------------------
type Cell = {
  key: string;
  range: string;
  style: string;
  proposals: number;
  added: number;
  merged: number;
  outOfRange: number;
  referenceConfirmed: number;
  priceConfirmed: number;
  errors: number;
  seconds: number;
  finishedAt: string;
};
const progress = existsSync(".catalogue-build/progress.json")
  ? (JSON.parse(readFileSync(".catalogue-build/progress.json", "utf8")) as {
      startedAt: string;
      cells: Record<string, Cell>;
      calls: Record<string, number>;
    })
  : { startedAt: "", cells: {}, calls: {} };
const cells = Object.values(progress.cells);
const sum = (key: keyof Cell) =>
  cells.reduce((total, cell) => total + Number(cell[key]), 0);
const spend =
  (progress.calls["perplexity-chat"] ?? 0) * 0.0075 +
  (progress.calls["perplexity-search"] ?? 0) * 0.005 +
  (progress.calls.muse ?? 0) * 0.006;
const lastFinished =
  cells
    .map((cell) => cell.finishedAt)
    .sort()
    .at(-1) ?? "";

// --- Quiz test runs against the catalogue (live search not run) -----------
const base: ProfileV4 = {
  version: 4,
  budgetCurrency: "USD",
  priceRange: "1000_2000",
  wristCm: 17.5,
  wearingScenarios: ["office"],
  minimumWaterResistanceM: 0,
  movementTypes: ["automatic", "manual", "quartz", "solar", "spring_drive"],
  requiredComplications: [],
  allergyConstraint: "none",
};
const quizCases: { label: string; profile: ProfileV4 }[] = [
  {
    label: "USD 0–500, everyday, 16 cm wrist",
    profile: {
      ...base,
      priceRange: "0_500",
      wristCm: 16,
      wearingScenarios: ["everyday"],
    },
  },
  {
    label: "USD 500–1k, field, 17.5 cm, 100 m",
    profile: {
      ...base,
      priceRange: "500_1000",
      wearingScenarios: ["field"],
      minimumWaterResistanceM: 100,
    },
  },
  {
    label: "USD 1k–2k, dive, 18.5 cm, 200 m, automatic",
    profile: {
      ...base,
      wristCm: 18.5,
      wearingScenarios: ["diving"],
      minimumWaterResistanceM: 200,
      movementTypes: ["automatic"],
    },
  },
  {
    label: "EUR 2k–3k, dress, 16.5 cm",
    profile: {
      ...base,
      budgetCurrency: "EUR",
      priceRange: "2000_3000",
      wristCm: 16.5,
      wearingScenarios: ["black_tie"],
    },
  },
  {
    label: "GBP 3k–4k, travel (GMT), 17.5 cm",
    profile: {
      ...base,
      budgetCurrency: "GBP",
      priceRange: "3000_4000",
      wearingScenarios: ["travel"],
      requiredComplications: ["gmt"],
    },
  },
  {
    label: "USD 4k–5k, sport, 19 cm, edited range 40–43 mm",
    profile: {
      ...base,
      priceRange: "4000_5000",
      wristCm: 19,
      caseDiameterMinMm: 40,
      caseDiameterMaxMm: 43,
      wearingScenarios: ["sport"],
    },
  },
  {
    label: "CHF 7k–8k, everyday, 17 cm",
    profile: {
      ...base,
      budgetCurrency: "CHF",
      priceRange: "7000_8000",
      wristCm: 17,
    },
  },
  {
    label: "USD 9k–10k, dive, 17.5 cm, 300 m",
    profile: {
      ...base,
      priceRange: "9000_10000",
      wearingScenarios: ["diving"],
      minimumWaterResistanceM: 300,
    },
  },
  {
    label: "USD 1k–2k, everyday, nickel allergy",
    profile: { ...base, allergyConstraint: "nickel_contact" },
  },
  {
    label: "USD 15k–20k (above 10k: live search)",
    profile: { ...base, priceRange: "15000_20000" },
  },
];
const quizRows: string[] = [];
for (const test of quizCases) {
  let liveNeeded = false;
  const started = performance.now();
  const result = await searchQuiz(test.profile, {
    client,
    loadFx: () => Promise.resolve(fx),
    runLive: (): Promise<AiSearchView> => {
      liveNeeded = true;
      return Promise.resolve({
        status: "no_match",
        summary: "live search not run in the report",
      });
    },
  });
  const ms = Math.round(performance.now() - started);
  const main = result.status === "found" ? result.watches : [];
  const also = result.status === "found" ? (result.alsoWorth ?? []) : [];
  quizRows.push(
    `| ${esc(test.label)} | ${main.length} | ${also.length} | ${liveNeeded ? "yes" : "no"} | ${ms} ms | ${esc(main.map((watch) => `${watch.brand} ${watch.model}`).join("; "))} |`,
  );
}

// --- Film / people retest ---------------------------------------------------
type FilmRow = {
  kind: string;
  query: string;
  status: string;
  seconds: number;
  watches: {
    name: string;
    person: string | null;
    work: string | null;
    evidence: string;
    photo: boolean;
  }[];
};
const film = existsSync(".catalogue-build/film-retest.json")
  ? (JSON.parse(readFileSync(".catalogue-build/film-retest.json", "utf8")) as {
      ranAt: string;
      rows: FilmRow[];
    })
  : null;

// --- Markdown --------------------------------------------------------------
const lines: string[] = [];
const push = (...values: string[]) => lines.push(...values);
const confirmedRef = live.filter((watch) => watch.referenceConfirmed).length;
const confirmedPrice = live.filter(
  (watch) => watch.priceStatus === "confirmed",
).length;
const withPhoto = live.filter((watch) => watch.imageUrl).length;
const byStatus = (status: string) =>
  all.filter((watch) => watch.reviewStatus === status).length;

push(
  `# The Reserve — watch catalogue report`,
  "",
  `Generated ${new Date().toISOString().replace("T", " ").slice(0, 16)} UTC.`,
  "",
  "## Summary",
  "",
  `- **Catalogue size:** ${all.length} watches (${byStatus("pending")} pending, ${byStatus("approved")} approved, ${byStatus("rejected")} rejected).`,
  `- **Reference confirmed** on a manufacturer or authorised-retailer page: ${confirmedRef} (${pct(confirmedRef, live.length)}). The others appear only under "Also worth a look".`,
  `- **Price confirmed** (two independent lookups within ±5% in the same currency, each source live or under 90 days old; Perplexity first, then Muse Spark's own web search for watches with a confirmed reference. Muse was added after search 78, so earlier watches have not had it yet): ${confirmedPrice} (${pct(confirmedPrice, live.length)}). A watch without a confirmed price is never shown by the price filter; the daily recheck keeps trying.`,
  `- **Photo URL** found: ${withPhoto} (${pct(withPhoto, live.length)}).`,
  "",
  "## Build run",
  "",
  `- Searches finished: ${cells.length} of 660 (11 price ranges up to 10k × 6 styles × 10 runs).`,
  `- Started ${progress.startedAt.slice(0, 16).replace("T", " ")}, last search finished ${lastFinished.slice(0, 16).replace("T", " ")} (UTC).`,
  `- Proposals: ${sum("proposals")}; outside the searched range: ${sum("outOfRange")}; new watches: ${sum("added")}; repeat finds merged: ${sum("merged")}; errors: ${sum("errors")}.`,
  `- Provider calls: ${Object.entries(progress.calls)
    .map(([kind, count]) => `${kind} ${count}`)
    .join(", ")}.`,
  `- Estimated spend: about USD ${spend.toFixed(2)} (Perplexity at list prices; Muse Spark as a rough allowance).`,
  "",
  "### Confirmed watches per price range and style",
  "",
  "Counts of watches with a confirmed reference and a confirmed price in that range (USD list price) and style.",
  "",
  `| Range | ${CATALOGUE_STYLES.map((style) => STYLE_LABELS[style]).join(" | ")} |`,
  `|---|${CATALOGUE_STYLES.map(() => "---:").join("|")}|`,
  ...ranges.map((range) => {
    const inRange = live.filter(
      (watch) => watch.referenceConfirmed && usdRange(watch)?.id === range.id,
    );
    return `| ${priceRangeLabel(range, "USD")} | ${CATALOGUE_STYLES.map((style) => inRange.filter((watch) => watch.styles.includes(style)).length).join(" | ")} |`;
  }),
  "",
  "## Quiz test runs (catalogue only)",
  "",
  'Each profile was filtered from the catalogue in code. "Live search" says whether the quiz would also run the live search (fewer than three confirmed fits, or above 10k); it was not run here.',
  "",
  "| Profile | Main picks | Also worth a look | Live search | Time | Main picks |",
  "|---|---:|---:|---|---:|---|",
  ...quizRows,
  "",
  "## Film and people search retest",
  "",
);
if (film) {
  push(
    `Run ${film.ranAt.slice(0, 16).replace("T", " ")} UTC with Muse Spark and Perplexity only (no catalogue), bypassing stored results.`,
    "",
    "| Kind | Search | Result | Watches | Photos | Time | Watches found |",
    "|---|---|---|---:|---:|---:|---|",
    ...film.rows.map(
      (row) =>
        `| ${row.kind} | ${esc(row.query)} | ${row.status} | ${row.watches.length} | ${row.watches.filter((watch) => watch.photo).length} | ${row.seconds} s | ${esc(row.watches.map((watch) => `${watch.name}${watch.person ? ` (${watch.person})` : ""}`).join("; "))} |`,
    ),
    "",
  );
} else {
  push("Not run yet.", "");
}

push(
  "## Every catalogue watch",
  "",
  "Wrist fit is the range of wrist sizes whose suggested case range includes the diameter. Price range is the USD range of the confirmed list price; where the price is not confirmed, the range the search found it in is shown in brackets.",
  "",
);
const sorted = [...all].sort(
  (a, b) =>
    (priceIn(a, "USD", fx) ?? Number.MAX_SAFE_INTEGER) -
      (priceIn(b, "USD", fx) ?? Number.MAX_SAFE_INTEGER) ||
    a.brand.localeCompare(b.brand) ||
    a.model.localeCompare(b.model),
);
push(
  "| # | Watch | Reference | Diameter | Wrist fit | Price | Price range | Style | Reference | Review |",
  "|---:|---|---|---:|---|---:|---|---|---|---|",
  ...sorted.map((watch, index) => {
    const range = usdRange(watch);
    const found = foundRanges(watch)
      .map((id) => PRICE_RANGES.find((entry) => entry.id === id))
      .filter((entry) => entry !== undefined)
      .map((entry) => priceRangeLabel(entry, "USD"));
    const price =
      watch.priceStatus === "confirmed" && watch.priceAmount !== null
        ? `${watch.priceCurrency} ${Math.round(watch.priceAmount).toLocaleString("en")}`
        : "not confirmed";
    return `| ${index + 1} | ${esc(`${watch.brand} ${watch.model}`)} | ${esc(watch.referenceCode)} | ${watch.caseDiameterMm !== null ? `${watch.caseDiameterMm} mm` : "—"} | ${wristFitLabel(watch.caseDiameterMm)} | ${price} | ${range ? priceRangeLabel(range, "USD") : found.length > 0 ? `(${found.join(", ")})` : "—"} | ${watch.styles.map((style) => STYLE_LABELS[style]).join(", ") || "—"} | ${watch.referenceConfirmed ? "confirmed" : "not confirmed"} | ${watch.reviewStatus} |`;
  }),
  "",
);

mkdirSync("docs/reports", { recursive: true });
const file = `docs/reports/catalogue-report-${today}.md`;
writeFileSync(file, lines.join("\n"));
copyFileSync(
  file,
  path.join(DESKTOP, `TheReserve_catalogue-report_${today}.md`),
);
console.log(
  `Wrote ${file} and copied it to the Desktop (${all.length} watches).`,
);

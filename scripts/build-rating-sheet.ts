// Builds the owner's rating page from a live evaluation report: a fixed
// sample of cards (10 diagnostic answers, 8 archetype results, 10
// alternatives cases, every film card), each shown with the request it
// answered, in Russian and English.
//
//   node --import tsx scripts/build-rating-sheet.ts \
//     --report docs/reports/eval-live-2026-11-26.json --out <page.html>
//
// Several reports (for example film searches) make one sheet with
// --report a.json,b.json --label films; a request asked again in a later
// report replaces the earlier answer.
//
// Also writes docs/reports/rating-sheet-[<label>-]<date>.json: the sample
// the ratings are scored against. The page (scripts/rating-sheet-template.html) stores
// each rater's ratings in its own database under ratings/<rater>/cards.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  ARCHETYPE_BANDS,
  type PriceComfort,
} from "../app/domain/archetype-picks";
import {
  ARCHETYPES,
  type ArchetypeId,
} from "../app/domain/discovery-archetype";
import {
  diameterRangeFor,
  findPriceRange,
  priceRangeLabel,
  type ProfileV4,
} from "../app/domain/questionnaire-v4";

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const reportPath = option("report");
const out = option("out");
const label = option("label");
if (!reportPath || !out)
  throw new Error(
    "--report <eval-live json[,more.json]> and --out <page.html> are required.",
  );
if (label !== undefined && !/^[a-z0-9-]{1,40}$/.test(label))
  throw new Error("--label takes lowercase letters, digits and dashes.");

type Card = Record<string, unknown> & {
  brand: string;
  model: string;
  referenceCode: string | null;
};
type CaseResult = {
  tool: "quiz" | "archetype" | "alternatives" | "film";
  id: string;
  round: number;
  input: Record<string, unknown>;
  status: string;
  target?: string | null;
  checks: Record<string, unknown>;
  cards: Card[];
};
const reports = reportPath.split(",").map(
  (path) =>
    JSON.parse(readFileSync(path, "utf8")) as {
      startedAt: string;
      dryRun: boolean;
      cases: CaseResult[];
    },
);
if (reports.some((report) => report.dryRun))
  throw new Error("A dry run has no live answers to rate.");
const date = reports
  .map((report) => report.startedAt.slice(0, 10))
  .sort()
  .at(-1)!;

// The answer a visitor gets now: the last round that ran for each case, and
// across reports the latest answer to the same request.
const finals = [
  ...new Map(
    reports
      .flatMap((report) => report.cases)
      .map((result) => [
        reports.length > 1
          ? `${result.tool}|${JSON.stringify(result.input)}`
          : result.id,
        result,
      ]),
  ).values(),
].sort((a, b) => a.id.localeCompare(b.id));
const found = (tool: CaseResult["tool"]) =>
  finals.filter(
    (result) =>
      result.tool === tool &&
      result.status === "found" &&
      result.cards.length > 0,
  );

// ---------------------------------------------------------------------------
// The request each case answered, in plain words.

const SCENARIOS: Record<string, [string, string]> = {
  office: ["офис", "office"],
  everyday: ["на каждый день", "everyday"],
  resort: ["курорт", "resort"],
  travel: ["путешествия", "travel"],
  sport: ["спорт", "sport"],
};
const MOVEMENTS: Record<string, [string, string]> = {
  automatic: ["автоподзавод", "automatic"],
  manual: ["ручной завод", "hand-wound"],
  quartz: ["кварц", "quartz"],
  solar: ["солнечная батарея", "solar"],
  spring_drive: ["Spring Drive", "Spring Drive"],
};
const ARCHETYPE_RU: Record<ArchetypeId, string> = {
  field_rationalist: "Полевой рационалист",
  quiet_custodian: "Тихий хранитель",
  architectural_modernist: "Архитектурный модернист",
  expressive_collector: "Экспрессивный коллекционер",
  mechanical_connoisseur: "Знаток механики",
  recognised_standard_bearer: "Признанный эталон",
};
const BAND_RU: Record<PriceComfort, string> = {
  first_good_watch: "первые хорошие часы, до USD 2,000",
  considered_entry: "первые серьёзные часы, около USD 2,000–5,000",
  established_collection: "покупка в коллекцию, около USD 5,000–10,000",
  exceptional_object: "исключительная вещь, от USD 10,000",
};
const KIND: Record<string, [string, string]> = {
  movie: ["фильм", "movie"],
  series: ["сериал", "series"],
  actor: ["актёр", "actor"],
  character: ["персонаж", "character"],
  celebrity: ["известный человек", "public figure"],
};
const pair = (ru: string, en: string) => ({ ru, en });

function quizRequest(profile: ProfileV4) {
  const range = findPriceRange(profile.priceRange)!;
  const diameter = diameterRangeFor(profile);
  const scenario = SCENARIOS[profile.wearingScenarios[0] ?? ""] ?? ["—", "—"];
  const movement = (lang: 0 | 1) =>
    profile.movementTypes
      .map((type) => MOVEMENTS[type]?.[lang] ?? type)
      .join(lang === 0 ? " или " : " or ");
  const water = profile.minimumWaterResistanceM;
  return pair(
    `Бюджет ${priceRangeLabel(range, profile.budgetCurrency)} · запястье ${profile.wristCm} см → корпус ${diameter.minimumMm}–${diameter.maximumMm} мм · ${scenario[0]} · ${water ? `водозащита от ${water} м` : "водозащита не важна"} · ${movement(0)}`,
    `Budget ${priceRangeLabel(range, profile.budgetCurrency)} · wrist ${profile.wristCm} cm → case ${diameter.minimumMm}–${diameter.maximumMm} mm · ${scenario[1]} · ${water ? `water resistance from ${water} m` : "no water requirement"} · ${movement(1)}`,
  );
}

function archetypeRequest(input: {
  archetype: ArchetypeId;
  band: PriceComfort;
}) {
  return pair(
    `${ARCHETYPE_RU[input.archetype]} · ${BAND_RU[input.band]}`,
    `${ARCHETYPES[input.archetype].title} · ${ARCHETYPE_BANDS[input.band].label}`,
  );
}

function alternativesRequest(result: CaseResult) {
  const input = result.input as {
    original: string;
    budget: { amount: number; currency: string };
    allowQuartz: boolean;
  };
  const named = result.target ?? input.original;
  const amount = input.budget.amount.toLocaleString("en-US");
  const chip = result.checks.chosenOption as string | null | undefined;
  return pair(
    `Дешевле, чем ${named} · около ${input.budget.currency} ${amount} (± 1,000) · ${input.allowQuartz ? "кварц и солнечные подходят" : "только механика"}${chip ? ` · выбран вариант «${chip}»` : ""}`,
    `Cheaper alternative to ${named} · around ${input.budget.currency} ${amount} (± 1,000) · ${input.allowQuartz ? "quartz or solar fine" : "mechanical only"}${chip ? ` · chip chosen: “${chip}”` : ""}`,
  );
}

function filmRequest(input: { query: string; kind: string }) {
  const kind = KIND[input.kind] ?? [input.kind, input.kind];
  return pair(
    `Часы из «${input.query}» (${kind[0]})`,
    `Watches seen in “${input.query}” (${kind[1]})`,
  );
}

function requestOf(result: CaseResult) {
  switch (result.tool) {
    case "quiz":
      return quizRequest(result.input as unknown as ProfileV4);
    case "archetype":
      return archetypeRequest(
        result.input as { archetype: ArchetypeId; band: PriceComfort },
      );
    case "alternatives":
      return alternativesRequest(result);
    case "film":
      return filmRequest(result.input as { query: string; kind: string });
  }
}

// ---------------------------------------------------------------------------
// The sample: fixed rules, so a later round's sheet is built the same way.

const everyNth = (list: CaseResult[], count: number) =>
  list.length <= count
    ? list
    : Array.from(
        { length: count },
        (_, i) => list[Math.floor((i * list.length) / count)]!,
      );
const quiz = everyNth(found("quiz"), 10);
const archetype = everyNth(found("archetype"), 8);
// One case per named watch first, then other budgets of the same watches.
const alternativesFound = found("alternatives");
const firstPerTarget = [
  ...new Map(
    alternativesFound.map((result) => [result.target ?? result.id, result]),
  ).values(),
];
const alternatives = [
  ...firstPerTarget,
  ...alternativesFound.filter((result) => !firstPerTarget.includes(result)),
].slice(0, 10);
const film = found("film");

const identity = (card: Card) =>
  `${card.brand}|${card.referenceCode ?? card.model}`.toLowerCase();
const cards = [...quiz, ...archetype, ...alternatives, ...film].flatMap(
  (result) => {
    const request = requestOf(result);
    const distinct = [
      ...new Map(result.cards.map((card) => [identity(card), card])).values(),
    ].slice(0, 10);
    // A labelled sheet is rebuilt as answers improve: its card ids come from
    // the request and the watch, not from the run, so a rating stays with
    // the same watch for the same request across rebuilds.
    return distinct.map((card, index) => ({
      id: label
        ? `${result.tool}-${createHash("sha256")
            .update(`${JSON.stringify(result.input)}|${identity(card)}`)
            .digest("hex")
            .slice(0, 16)}`
        : `${result.id}-${String(index + 1).padStart(2, "0")}`,
      caseId: result.id,
      tool: result.tool,
      request,
      ...card,
    }));
  },
);

const sheet = {
  id: label ? `${label}-${date}` : `live-${date}`,
  date,
  report: reportPath,
  cards,
};
writeFileSync(
  resolve(`docs/reports/rating-sheet-${label ? `${label}-` : ""}${date}.json`),
  `${JSON.stringify(sheet, null, 2)}\n`,
);
const template = readFileSync("scripts/rating-sheet-template.html", "utf8");
// JSON inside a <script> element: every < is escaped so no value can close it.
const json = JSON.stringify(sheet).replace(/</g, "\\u003c");
// A sheet of film cards only is its own page, with its own name.
const page = cards.every((card) => card.tool === "film")
  ? template.replace(
      "<title>Watch Card Ratings</title>",
      "<title>Film Watch Review</title>",
    )
  : template;
writeFileSync(out, page.replace("/*SHEET_JSON*/", json));
console.log(
  `Sheet ${sheet.id}: ${cards.length} cards (quiz ${quiz.length} answers, archetype ${archetype.length}, alternatives ${alternatives.length}, film ${film.length}) → ${out}`,
);

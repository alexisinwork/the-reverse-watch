// Builds the owner's review page for the independent film set
// (data/eval/film-labels-independent-2026-11-26.json; owner, 2026-11-26:
// "кидай, я проверю"). Each label is one card with the sources it rests on;
// the owner marks it right, unconfirmable or wrong on the same page design
// as the rating page.
//
//   node --import tsx scripts/build-label-review.ts --out <page.html>
//
// Never edits the label file: the review is stored in the page's own
// database, and a label the owner marks wrong is reported, not changed.
import { readFileSync, writeFileSync } from "node:fs";

const at = process.argv.indexOf("--out");
const out = at > 0 ? process.argv[at + 1] : undefined;
if (!out) throw new Error("--out <page.html> is required.");

type Source = {
  publisher: string;
  url: string;
  checked: string;
  says: string;
};
const set = JSON.parse(
  readFileSync("data/eval/film-labels-independent-2026-11-26.json", "utf8"),
) as {
  collectedAt?: string;
  positives: {
    id: string;
    query: string;
    kind: string;
    brand: string;
    models: string[];
    reference: string | null;
    note?: string;
    sources: Source[];
  }[];
};

const KIND: Record<string, [string, string]> = {
  movie: ["фильм", "movie"],
  series: ["сериал", "series"],
  actor: ["актёр", "actor"],
  character: ["персонаж", "character"],
  celebrity: ["известный человек", "celebrity"],
};

const cards = set.positives.map((label) => {
  const kind = KIND[label.kind] ?? [label.kind, label.kind];
  return {
    id: `label-${label.id}`,
    caseId: label.id,
    tool: "film",
    request: {
      ru: `Метка: часы из «${label.query}» (${kind[0]})`,
      en: `Label: a watch in “${label.query}” (${kind[1]})`,
    },
    section: "main",
    brand: label.brand,
    model: label.models.join(" / "),
    referenceCode: label.reference,
    price: null,
    priceCondition: null,
    priceConfirmed: null,
    caseDiameterMm: null,
    movement: null,
    waterResistanceM: null,
    verified: true,
    verificationNote: null,
    misses: [],
    person: label.note ?? null,
    work: label.query,
    sourceUrl:
      label.sources.find((source) => source.checked === "opened")?.url ?? null,
    referenceSourceUrl: null,
    imageUrl: null,
    rationale: label.sources
      .filter((source) => source.checked !== "opened")
      .map((source) => `${source.publisher}: ${source.checked}`)
      .join("; "),
    evidence: label.sources
      .filter((source) => source.checked === "opened")
      .map((source) => ({
        provider: source.publisher,
        sourceUrl: source.url,
        sourceQuote: source.says,
      })),
  };
});

const sheet = {
  id: "independent-film-labels-2026-11-26",
  date: set.collectedAt ?? "2026-11-26",
  title: {
    ru: "Проверка независимого набора фильмов",
    en: "Independent film set review",
  },
  lede: {
    ru: "Каждая карточка — одна метка независимого набора, по которому меряется поиск по фильмам: часы, которые, по двум открытым источникам, были в фильме или на человеке. Откройте источники и отметьте: «настоящее появление», если метка верна; «не подтвердить», если источники не убеждают; «неверно», если метка ошибочна. Сами метки здесь не меняются: ваша отметка записывается рядом.",
    en: "Each card is one label of the independent set that film search is measured against: a watch that two opened sources place in the film or on the person. Open the sources and mark it: “real sighting” if the label is right, “can't confirm” if the sources do not convince you, “wrong” if the label is wrong. The labels themselves are never changed here; your mark is stored beside them.",
  },
  report: "data/eval/film-labels-independent-2026-11-26.json",
  cards,
};
const template = readFileSync("scripts/rating-sheet-template.html", "utf8");
const json = JSON.stringify(sheet).replace(/</g, "\\u003c");
writeFileSync(
  out,
  template
    .replace(
      "<title>Watch Card Ratings</title>",
      "<title>Film Label Review</title>",
    )
    .replace("/*SHEET_JSON*/", json),
);
console.log(`Label review: ${cards.length} labels → ${out}`);

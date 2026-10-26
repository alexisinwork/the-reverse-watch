// Creates one owner-facing workbook: every retained Space City source record
// plus a finite, high-yield manual queue of non-Space-City-brand watches.
// Space City fields remain clearly labeled as historical listing aggregates.
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import postgres from "postgres";
import { catalogueIdentityKey } from "../app/domain/watch-catalogue";

const databaseUrl = process.env.DIRECT_DATABASE_URL;
if (!databaseUrl) throw new Error("DIRECT_DATABASE_URL required");

const SPACE_CITY_DIR = "data/watch-archive/spacecity";
const outputDir = "C:/Users/alexi/OneDrive/Desktop/TheReserve_manual_catalogue";
const today = new Date().toISOString().slice(0, 10);
const output = path.join(outputDir, `${today}-priority-coverage.xlsx`);
const REQUIRED = ["price", "movement", "diameter", "style", "photo"];

type SpaceCityReference = {
  ref: string;
  slug: string;
  name: string;
  sample_count?: number;
  sizes?: string[];
  movements?: string[];
  case_materials?: string[];
  bracelet_materials?: string[];
  conditions?: string[];
  sex?: string[];
  price?: {
    low?: number;
    median?: number;
    p25?: number;
    p75?: number;
    count?: number;
  };
  year_range?: number[];
};
type SpaceCityBrand = {
  name: string;
  models: { name: string; slug: string; refs: SpaceCityReference[] }[];
};
type Manifest = { files: { file: string }[]; declaredReferences: number };
type Watch = {
  id: string;
  brand: string;
  model: string;
  reference_code: string | null;
  review_status: string;
  reference_confirmed: boolean;
  import_source: string | null;
  source_url: string | null;
  price_amount: number | null;
  price_currency: string | null;
  price_status: string;
  movement: string | null;
  case_diameter_mm: number | null;
  styles: string[];
  image_url: string | null;
  found_in: unknown[];
};

const join = (items: string[] | undefined) => (items ?? []).join(" | ");
const sourceUrl = (brandSlug: string, modelSlug: string, refSlug: string) =>
  `https://spacecitytimepiece.com/watches/${brandSlug}/${modelSlug}/${refSlug}`;
const missing = (watch: Watch) =>
  REQUIRED.filter((field) => {
    if (field === "price")
      return (
        watch.price_amount === null || watch.price_status === "unconfirmed"
      );
    if (field === "movement") return watch.movement === null;
    if (field === "diameter") return watch.case_diameter_mm === null;
    if (field === "style") return watch.styles.length === 0;
    return watch.image_url === null;
  });

const manifest = JSON.parse(
  await readFile(`${SPACE_CITY_DIR}/manifest.json`, "utf8"),
) as Manifest;
const sourceRecords: {
  brand: string;
  brandSlug: string;
  model: string;
  modelSlug: string;
  reference: SpaceCityReference;
}[] = [];
const spaceCityBrands = new Set<string>();
for (const item of manifest.files) {
  const brandSlug = item.file.replace(/\.json$/, "");
  const brand = JSON.parse(
    await readFile(`${SPACE_CITY_DIR}/${item.file}`, "utf8"),
  ) as SpaceCityBrand;
  spaceCityBrands.add(brand.name.toLocaleLowerCase());
  for (const model of brand.models)
    for (const reference of model.refs)
      sourceRecords.push({
        brand: brand.name,
        brandSlug,
        model: model.name,
        modelSlug: model.slug,
        reference,
      });
}

const sql = postgres(databaseUrl, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
let watches: Watch[];
try {
  watches = await sql<
    Watch[]
  >`select id::text,brand,model,reference_code,review_status,reference_confirmed,import_source,source_url,price_amount,price_currency,price_status,movement,case_diameter_mm,styles,image_url,found_in from private.watch_catalogue where review_status <> 'rejected'`;
} finally {
  await sql.end();
}

const localByIdentity = new Map(
  watches
    .filter((watch) => watch.reference_code)
    .map((watch) => [
      catalogueIdentityKey(watch.brand, watch.model, watch.reference_code),
      watch,
    ]),
);
// No external popularity ranking is available in the local catalogue. This
// transparent order prioritizes established non-luxury brands with the most
// already-known facts, so the owner's manual work closes records efficiently.
const brandPriority = [
  "casio",
  "seiko",
  "citizen",
  "tissot",
  "timex",
  "orient",
  "g-shock",
  "swatch",
  "bulova",
  "certina",
  "mido",
  "hamilton",
  "longines",
  "rado",
  "junghans",
  "vaer",
  "baltic",
  "vostok",
  "sinn",
  "microbrand",
];
const brandScore = (brand: string) => {
  const index = brandPriority.indexOf(brand.toLocaleLowerCase());
  return index < 0 ? 0 : brandPriority.length - index;
};
const manual = watches
  .filter(
    (watch) =>
      !spaceCityBrands.has(watch.brand.toLocaleLowerCase()) &&
      watch.reference_code !== null &&
      missing(watch).length > 0,
  )
  .map((watch) => ({
    watch,
    missing: missing(watch),
    score:
      brandScore(watch.brand) * 100 +
      (watch.reference_confirmed ? 30 : 0) +
      (watch.source_url ? 15 : 0) +
      (watch.price_amount !== null ? 8 : 0) +
      (watch.movement ? 6 : 0) +
      (watch.case_diameter_mm !== null ? 5 : 0) +
      (watch.styles.length > 0 ? 4 : 0) +
      (watch.image_url ? 2 : 0) -
      missing(watch).length * 3,
  }))
  .sort(
    (a, b) =>
      b.score - a.score ||
      a.missing.length - b.missing.length ||
      a.watch.brand.localeCompare(b.watch.brand) ||
      a.watch.model.localeCompare(b.watch.model) ||
      (a.watch.reference_code ?? "").localeCompare(
        b.watch.reference_code ?? "",
      ),
  )
  .slice(0, 10_000);

const isQualified = (watch: Watch) =>
  watch.source_url !== null &&
  watch.reference_confirmed &&
  watch.case_diameter_mm !== null &&
  watch.movement !== null &&
  watch.styles.length > 0;
const coverage = {
  approvedWithUsablePrice: watches.filter(
    (watch) =>
      watch.review_status === "approved" &&
      watch.price_amount !== null &&
      watch.price_status !== "unconfirmed",
  ).length,
  qualificationReady: watches.filter(
    (watch) =>
      isQualified(watch) &&
      watch.price_amount !== null &&
      watch.price_status !== "unconfirmed",
  ).length,
  qualifiedWithoutPrice: watches.filter(
    (watch) =>
      isQualified(watch) &&
      (watch.price_amount === null || watch.price_status === "unconfirmed"),
  ).length,
  qualifiedWithoutPhoto: watches.filter(
    (watch) => isQualified(watch) && watch.image_url === null,
  ).length,
};

await mkdir(outputDir, { recursive: true });
const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
  filename: output,
  useStyles: true,
});
workbook.creator = "The Reserve";
const header = { bold: true, color: { argb: "FFFFFFFF" } };
const fill = {
  type: "pattern" as const,
  pattern: "solid" as const,
  fgColor: { argb: "FF243447" },
};
const setHeader = (sheet: ExcelJS.Worksheet) => {
  sheet.getRow(1).font = header;
  sheet.getRow(1).fill = fill;
};

const notes = workbook.addWorksheet("Read me");
notes.columns = [{ width: 30 }, { width: 110 }];
[
  ["Workbook", "Priority catalogue for manual completion"],
  [
    "Space City source",
    "All 25,385 CC BY 4.0 source records are preserved on the Space City (all) sheet. They are historical Chrono24 listing aggregates (2017–2023), not manufacturer-confirmed specifications or current retail prices.",
  ],
  [
    "Manual queue",
    `Exactly ${manual.length.toLocaleString("en")} non-Space-City-brand watches with at least one missing field. This is a transparent completion-priority queue, not an externally measured popularity ranking.`,
  ],
  [
    "How to edit",
    "Use the yellow Manual columns. Keep Catalogue ID unchanged. Enter a source URL with each value. Do not use marketplace/grey-market prices as confirmed retail prices.",
  ],
  [
    "Local match",
    "Space City rows include their exact local catalogue match when brand + model + reference is unambiguous. A blank match means that record remains source evidence only.",
  ],
].forEach((row) => notes.addRow(row));
notes.getRow(1).font = { bold: true };

const source = workbook.addWorksheet("Space City (all)");
source.columns = [
  { header: "Brand", key: "brand", width: 22 },
  { header: "Model", key: "model", width: 34 },
  { header: "Reference", key: "ref", width: 28 },
  { header: "Name", key: "name", width: 36 },
  { header: "Listings", key: "count", width: 10 },
  { header: "Sizes (aggregated)", key: "sizes", width: 24 },
  { header: "Movements (aggregated)", key: "movements", width: 22 },
  { header: "Case materials", key: "case", width: 22 },
  { header: "Bracelet materials", key: "bracelet", width: 22 },
  { header: "Condition", key: "condition", width: 22 },
  { header: "Sex", key: "sex", width: 24 },
  { header: "Price low", key: "low", width: 14 },
  { header: "Price median", key: "median", width: 14 },
  { header: "Price p75", key: "p75", width: 14 },
  { header: "Years", key: "years", width: 15 },
  { header: "Source page", key: "source", width: 48 },
  { header: "Local Catalogue ID", key: "localId", width: 38 },
  { header: "Local data gaps", key: "gaps", width: 28 },
];
setHeader(source);
for (const row of sourceRecords) {
  const local = localByIdentity.get(
    catalogueIdentityKey(row.brand, row.model, row.reference.ref),
  );
  source
    .addRow({
      brand: row.brand,
      model: row.model,
      ref: row.reference.ref,
      name: row.reference.name,
      count: row.reference.sample_count ?? row.reference.price?.count ?? null,
      sizes: join(row.reference.sizes),
      movements: join(row.reference.movements),
      case: join(row.reference.case_materials),
      bracelet: join(row.reference.bracelet_materials),
      condition: join(row.reference.conditions),
      sex: join(row.reference.sex),
      low: row.reference.price?.low ?? null,
      median: row.reference.price?.median ?? null,
      p75: row.reference.price?.p75 ?? null,
      years: join(row.reference.year_range?.map(String)),
      source: {
        text: sourceUrl(row.brandSlug, row.modelSlug, row.reference.slug),
        hyperlink: sourceUrl(row.brandSlug, row.modelSlug, row.reference.slug),
      },
      localId: local?.id ?? "",
      gaps: local ? missing(local).join(", ") : "no exact local match",
    })
    .commit();
}
source.autoFilter = { from: "A1", to: "R1" };

const queue = workbook.addWorksheet("Manual 10k");
queue.columns = [
  { header: "Rank", key: "rank", width: 8 },
  { header: "Catalogue ID (do not change)", key: "id", width: 38 },
  { header: "Brand", key: "brand", width: 22 },
  { header: "Model", key: "model", width: 34 },
  { header: "Reference", key: "reference", width: 28 },
  { header: "Missing now", key: "missing", width: 28 },
  { header: "Current price", key: "price", width: 16 },
  { header: "Movement", key: "movement", width: 16 },
  { header: "Diameter mm", key: "diameter", width: 14 },
  { header: "Styles", key: "styles", width: 24 },
  { header: "Photo", key: "photo", width: 12 },
  { header: "Current source", key: "currentSource", width: 44 },
  { header: "Manual price", key: "manualPrice", width: 14 },
  { header: "Currency", key: "currency", width: 12 },
  { header: "Manual movement", key: "manualMovement", width: 18 },
  { header: "Manual diameter mm", key: "manualDiameter", width: 18 },
  { header: "Manual styles", key: "manualStyles", width: 24 },
  { header: "Manual photo URL", key: "manualPhoto", width: 44 },
  { header: "Evidence URL", key: "evidence", width: 48 },
  { header: "Checked date", key: "checked", width: 15 },
  { header: "Notes", key: "notes", width: 40 },
];
setHeader(queue);
for (const [index, entry] of manual.entries()) {
  const watch = entry.watch;
  const row = queue.addRow({
    rank: index + 1,
    id: watch.id,
    brand: watch.brand,
    model: watch.model,
    reference: watch.reference_code,
    missing: entry.missing.join(", "),
    price:
      watch.price_amount === null
        ? ""
        : `${watch.price_currency ?? ""} ${watch.price_amount}`.trim(),
    movement: watch.movement ?? "",
    diameter: watch.case_diameter_mm ?? "",
    styles: watch.styles.join(", "),
    photo: watch.image_url ? { text: "open", hyperlink: watch.image_url } : "",
    currentSource: watch.source_url
      ? { text: watch.source_url, hyperlink: watch.source_url }
      : "",
  });
  for (const key of [
    "manualPrice",
    "currency",
    "manualMovement",
    "manualDiameter",
    "manualStyles",
    "manualPhoto",
    "evidence",
    "checked",
    "notes",
  ])
    row.getCell(key).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFF2CC" },
    };
  row.commit();
}
queue.autoFilter = { from: "A1", to: "U1" };

await workbook.commit();
console.log(
  JSON.stringify(
    {
      output,
      sourceRecords: sourceRecords.length,
      manualRecords: manual.length,
      totalLive: watches.length,
      coverage,
    },
    null,
    2,
  ),
);

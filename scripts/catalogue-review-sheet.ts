// Writes an Excel workbook of every catalogue watch for manual review:
// what is missing or doubtful about each one, with links to its source
// page, its photo and its entry on /admin/catalogue. Saved to the Desktop.
//   node --env-file=.env --import tsx scripts/catalogue-review-sheet.ts
import ExcelJS from "exceljs";

import { loadFxTable } from "../app/domain/fx.server";
import { PRICE_RANGES, priceRangeLabel } from "../app/domain/questionnaire-v4";
import {
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
const SITE = "https://thereserve.watch";

const client = catalogueClient();
if (!client) throw new Error("Supabase service key required.");
const fx = await loadFxTable();
const watches = await listCatalogue(client, true);

const PRICE_REASONS: Record<string, string> = {
  first_lookup_empty: "no price found online",
  first_source_stale: "price found only on old pages",
  second_lookup_empty: "second check found no price",
  second_source_stale: "second check found only old pages",
  currency_mismatch: "second check found another market's price",
  lookups_disagree: "the two checks disagree by more than 5%",
};

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
const brandKey = (brand: string) => fold(brand.split(/\s+/)[0] ?? brand);
const referenceKey = (reference: string | null) =>
  reference ? fold(reference) : null;

// Same first brand word and reference, or same first brand word and model:
// likely the same watch recorded twice (e.g. "IWC" and "IWC Schaffhausen").
const byReference = new Map<string, CatalogueWatch[]>();
const byModel = new Map<string, CatalogueWatch[]>();
for (const watch of watches) {
  const reference = referenceKey(watch.referenceCode);
  if (reference && reference.length >= 4) {
    const key = `${brandKey(watch.brand)}|${reference}`;
    byReference.set(key, [...(byReference.get(key) ?? []), watch]);
  }
  const model = `${brandKey(watch.brand)}|${fold(watch.model)}`;
  byModel.set(model, [...(byModel.get(model) ?? []), watch]);
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
  ]
    .map((id) => PRICE_RANGES.find((range) => range.id === id))
    .filter((range) => range !== undefined);
}

function issuesOf(watch: CatalogueWatch) {
  const issues: string[] = [];
  if (!watch.referenceConfirmed) {
    issues.push(
      "Reference not confirmed on a maker or authorised-retailer page",
    );
  }
  if (!watch.sourceUrl) issues.push("No source page");
  if (watch.priceStatus !== "confirmed") {
    const reason = (watch.priceEvidence as { reason?: string }).reason;
    issues.push(
      `No confirmed price${reason && PRICE_REASONS[reason] ? ` (${PRICE_REASONS[reason]})` : ""}`,
    );
  }
  if (watch.priceChange) issues.push("Price recheck found a different price");
  const missing = [
    watch.caseDiameterMm === null ? "diameter" : null,
    watch.waterResistanceM === null ? "water resistance" : null,
    watch.movement === null ? "movement" : null,
    watch.caseMaterial === null ? "case material" : null,
    watch.strapMaterial === null ? "strap material" : null,
  ].filter(Boolean);
  if (missing.length > 0) issues.push(`Missing: ${missing.join(", ")}`);
  if (!watch.imageUrl) issues.push("No photo");
  if (watch.styles.length === 0) issues.push("No wearing style");
  if (
    watch.caseDiameterMm !== null &&
    (watch.caseDiameterMm < 25 || watch.caseDiameterMm > 55)
  ) {
    issues.push(`Unusual diameter (${watch.caseDiameterMm} mm)`);
  }
  if (
    watch.styles.includes("dive") &&
    watch.waterResistanceM !== null &&
    watch.waterResistanceM < 100
  ) {
    issues.push(`Listed as dive but only ${watch.waterResistanceM} m`);
  }
  const usd = priceIn(watch, "USD", fx);
  const ranges = foundRanges(watch);
  if (
    usd !== null &&
    ranges.length > 0 &&
    !ranges.some(
      (range) =>
        usd >= range.minimum * 0.8 &&
        (range.maximum === null || usd <= range.maximum * 1.2),
    )
  ) {
    issues.push(
      `Confirmed price is far from the range it was found in (${ranges.map((range) => priceRangeLabel(range, "USD")).join(", ")})`,
    );
  }
  const reference = referenceKey(watch.referenceCode);
  const twins = [
    ...(reference
      ? (byReference.get(`${brandKey(watch.brand)}|${reference}`) ?? [])
      : []),
    // Same model name only counts when one of the two has no reference:
    // different references of one model are colour or size variants.
    ...(
      byModel.get(`${brandKey(watch.brand)}|${fold(watch.model)}`) ?? []
    ).filter((other) => !reference || !referenceKey(other.referenceCode)),
  ].filter((other) => other.id !== watch.id);
  if (twins.length > 0) {
    issues.push(
      `Possible duplicate of ${[...new Set(twins.map((other) => `${other.brand} ${other.model} ${other.referenceCode ?? ""}`.trim()))].join("; ")}`,
    );
  }
  return issues;
}

const rows = watches
  .map((watch) => ({ watch, issues: issuesOf(watch) }))
  .sort(
    (a, b) =>
      b.issues.length - a.issues.length ||
      a.watch.brand.localeCompare(b.watch.brand) ||
      a.watch.model.localeCompare(b.watch.model),
  );

const workbook = new ExcelJS.Workbook();
workbook.creator = "The Reserve";

// Sheet 1: every watch
const sheet = workbook.addWorksheet("All watches", {
  views: [{ state: "frozen", ySplit: 1, xSplit: 3 }],
});
sheet.columns = [
  { header: "#", key: "n", width: 6 },
  { header: "Review", key: "review", width: 10 },
  { header: "Watch", key: "watch", width: 42 },
  { header: "Issues to check", key: "issues", width: 70 },
  { header: "Reference", key: "reference", width: 22 },
  { header: "Reference confirmed", key: "refOk", width: 11 },
  { header: "Price", key: "price", width: 14 },
  { header: "Price range (USD)", key: "range", width: 16 },
  { header: "Diameter (mm)", key: "diameter", width: 10 },
  { header: "Wrist fit", key: "wrist", width: 14 },
  { header: "Water resistance (m)", key: "water", width: 11 },
  { header: "Movement", key: "movement", width: 12 },
  { header: "Styles", key: "styles", width: 22 },
  { header: "Case / back / strap", key: "materials", width: 40 },
  { header: "Source page", key: "source", width: 34 },
  { header: "Photo", key: "photo", width: 12 },
  { header: "Open in admin", key: "admin", width: 14 },
];
sheet.getRow(1).font = { bold: true };
sheet.autoFilter = { from: "A1", to: "Q1" };

rows.forEach(({ watch, issues }, index) => {
  const usd = priceIn(watch, "USD", fx);
  const range =
    usd === null
      ? null
      : PRICE_RANGES.find(
          (entry) =>
            usd >= entry.minimum &&
            (entry.maximum === null || usd < entry.maximum),
        );
  const row = sheet.addRow({
    n: index + 1,
    review: watch.reviewStatus,
    watch: `${watch.brand} ${watch.model}`,
    issues: issues.length > 0 ? issues.join("\n") : "Looks complete",
    reference: watch.referenceCode ?? "",
    refOk: watch.referenceConfirmed ? "yes" : "no",
    price:
      watch.priceStatus === "confirmed" && watch.priceAmount !== null
        ? `${watch.priceCurrency} ${Math.round(watch.priceAmount).toLocaleString("en")}`
        : "not confirmed",
    range: range ? priceRangeLabel(range, "USD") : "",
    diameter: watch.caseDiameterMm ?? "",
    wrist: wristFitLabel(watch.caseDiameterMm),
    water: watch.waterResistanceM ?? "",
    movement: watch.movement ?? "",
    styles: watch.styles.map((style) => STYLE_LABELS[style]).join(", "),
    materials: [watch.caseMaterial, watch.casebackMaterial, watch.strapMaterial]
      .map((value) => value ?? "?")
      .join(" / "),
    source: watch.sourceUrl
      ? { text: watch.sourceUrl, hyperlink: watch.sourceUrl }
      : "",
    photo: watch.imageUrl ? { text: "photo", hyperlink: watch.imageUrl } : "",
    admin: {
      text: "open",
      hyperlink: `${SITE}/admin/catalogue?status=all&q=${encodeURIComponent(watch.referenceCode ?? watch.model)}`,
    },
  });
  row.alignment = { vertical: "top", wrapText: true };
  if (issues.length > 0) {
    row.getCell("issues").fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: issues.length >= 3 ? "FFF8D7DA" : "FFFFF3CD" },
    };
  }
});

// Sheet 2: how many watches have each kind of issue
const summary = workbook.addWorksheet("Summary");
summary.columns = [
  { header: "Issue", key: "issue", width: 60 },
  { header: "Watches", key: "count", width: 10 },
];
summary.getRow(1).font = { bold: true };
const counts = new Map<string, number>();
for (const { issues } of rows) {
  for (const issue of issues) {
    const kind = issue
      .replace(/ \(.*$/, "")
      .replace(/ of .*$/, "")
      .replace(/^Missing: .*$/, "Missing facts");
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
}
summary.addRow({ issue: "Watches in the catalogue", count: rows.length });
summary.addRow({
  issue: "Watches with no issues",
  count: rows.filter((row) => row.issues.length === 0).length,
});
for (const [issue, count] of [...counts].sort((a, b) => b[1] - a[1])) {
  summary.addRow({ issue, count });
}

const today = new Date().toISOString().slice(0, 10);
const file = `${DESKTOP}/TheReserve_catalogue-review_${today}.xlsx`;
await workbook.xlsx.writeFile(file);
console.log(`Wrote ${file}: ${rows.length} watches.`);
for (const [issue, count] of [...counts].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(4)}  ${issue}`);
}
console.log(
  `  ${String(rows.filter((row) => row.issues.length === 0).length).padStart(4)}  with no issues`,
);

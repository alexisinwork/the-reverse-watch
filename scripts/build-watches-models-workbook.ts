import fs from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";

import { BUNDLED_VOCABULARY } from "../app/domain/catalogue-vocabulary";

type MicroAdjustment = {
  present: boolean;
  systemName: string | null;
  rangeMm: number | null;
};

type Target = {
  id: string;
  referenceLabel: string;
  catalogueVariantId?: string;
};
type Brand = { slug: string; name: string; targets?: Target[] };
type Variant = {
  id: string;
  brand: { name: string };
  collection?: string;
  model?: string;
  referenceCode?: string;
  variantName?: string;
  productUrl?: string;
  geometry?: {
    lugToLugMm?: number | null;
    caseThicknessMm?: number | null;
    caseDiameterMm?: number | null;
    lugWidthMm?: number | null;
    integratedBracelet?: boolean | null;
    caseShape?: string | null;
  };
  materials?: {
    caseback?: string | null;
    bracelet?: string | null;
    displayCaseback?: boolean | null;
  };
  movement?: {
    type?: string | null;
    caliber?: string | null;
    construction?: string | null;
  };
  operation?: {
    waterResistanceM?: number | null;
    crystal?: string | null;
    microAdjustment?: MicroAdjustment | null;
  };
  wearingScenarios?: string[];
  positioningLine?: string | null;
  traits?: { socialSignals?: string[]; primaryArchetype?: string };
};

const root = process.cwd();
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "data/research/brand-manifest.json"), "utf8"),
) as { brands: Brand[] };
const catalogue = JSON.parse(
  fs.readFileSync(
    path.join(root, "data/catalogue/seed-catalogue.json"),
    "utf8",
  ),
) as { variants: Variant[] };
const byId = new Map(
  catalogue.variants.map((variant) => [variant.id, variant]),
);
const headers = [
  "Модель / reference",
  "Ссылка производителя",
  "lug2lug, mm",
  "Толщина корпуса, mm",
  "Диаметр корпуса, mm",
  "Форма корпуса",
  "Дно: display-back",
  "Интегрированный браслет",
  "Механизм: тип",
  "Механизм: массовый / мануфактурный",
  "Водозащита",
  "Стекло",
  "Ширина крепления (lug width), mm",
  "Микрорегулировка",
  "Сценарий ношения",
  "Социальный контекст",
  "Статус проверки",
  "Примечание / что проверить",
];

function sheetName(name: string, used: Set<string>) {
  const base =
    name
      .replace(/[\\/*?:[\]]/g, " ")
      .trim()
      .slice(0, 31) || "Brand";
  let result = base;
  let n = 2;
  while (used.has(result)) result = `${base.slice(0, 28)} (${n++})`;
  used.add(result);
  return result;
}
function water(value: number | null | undefined) {
  if (value == null) return "";
  if (value >= 200)
    return `${value} м — дайвинг/плавание при соблюдении инструкции`;
  if (value >= 100) return `${value} м — плавание и активная вода`;
  if (value >= 50)
    return `${value} м — брызги и краткий контакт с водой; не дайвинг`;
  return `${value} м — только брызги/повседневное ношение; не плавать`;
}
const SCENARIO_LABELS = new Map(
  BUNDLED_VOCABULARY.filter((row) => row.kind === "wearing_scenario").map(
    (row) => [row.slug, row.labelEn],
  ),
);

function scenarios(values: string[] | undefined) {
  return (values ?? [])
    .map((slug) => SCENARIO_LABELS.get(slug) ?? slug)
    .filter(Boolean)
    .join(" / ");
}

const SHAPE_LABELS: Record<string, string> = {
  round: "круглая",
  tonneau: "тонно",
  rectangular: "прямоугольная",
  cushion: "подушка",
  square: "квадратная",
  oval: "овальная",
  other: "другая",
};

function caseShape(value: string | null | undefined) {
  if (value == null) return "";
  return SHAPE_LABELS[value] ?? value;
}

function displayCaseback(value: boolean | null | undefined) {
  if (value == null) return "";
  return value ? "да" : "нет";
}

function construction(
  value: string | null | undefined,
  caliber: string | null | undefined,
) {
  if (value == null) return caliber ? `(${caliber})` : "";
  const label = value === "manufacture" ? "мануфактурный" : "массовый";
  return caliber ? `${label} (${caliber})` : label;
}

function microAdjustment(value: MicroAdjustment | null | undefined) {
  if (value == null) return "";
  if (!value.present) {
    return value.systemName ? `нет (${value.systemName})` : "нет";
  }
  const name = value.systemName ?? "есть";
  return value.rangeMm === null ? name : `${name} (+${value.rangeMm} мм)`;
}

const workbook = new ExcelJS.Workbook();
workbook.creator = "The Reserve";
const used = new Set<string>();
for (const brand of manifest.brands) {
  const sheet = workbook.addWorksheet(sheetName(brand.name, used));
  sheet.addRow(headers);
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF243447" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const target of brand.targets ?? []) {
    const variant = byId.get(target.catalogueVariantId ?? target.id);
    const g = variant?.geometry;
    const m = variant?.materials;
    const op = variant?.operation;
    sheet.addRow([
      target.referenceLabel,
      variant?.productUrl ?? "",
      g?.lugToLugMm ?? "",
      g?.caseThicknessMm ?? "",
      g?.caseDiameterMm ?? "",
      caseShape(g?.caseShape),
      displayCaseback(
        m?.displayCaseback ??
          (m?.caseback?.toLowerCase().includes("exhibition") ? true : null),
      ),
      g?.integratedBracelet == null ? "" : g.integratedBracelet ? "да" : "нет",
      variant?.movement?.type ?? "",
      construction(variant?.movement?.construction, variant?.movement?.caliber),
      water(op?.waterResistanceM),
      op?.crystal ?? "",
      g?.lugWidthMm ?? "",
      microAdjustment(op?.microAdjustment),
      scenarios(variant?.wearingScenarios),
      variant?.positioningLine ??
        variant?.traits?.socialSignals?.join("; ") ??
        "",
      variant ? "catalogue data; needs owner review" : "needs research",
      variant
        ? "Проверить форму, display-back, тип механизма, microadjust и социальный контекст"
        : "Нет точного варианта в seed-catalogue; заполнить по первичному источнику",
    ]);
  }
  sheet.autoFilter = {
    from: "A1",
    to: `${String.fromCharCode(64 + headers.length)}1`,
  };
  sheet.columns.forEach((column, i) => {
    column.width = i === 0 ? 48 : i === 1 ? 46 : 24;
  });
}
const output = path.join(root, "data/research/Watches& Models.xlsx");
await workbook.xlsx.writeFile(output);
console.log(
  `Wrote ${manifest.brands.length} brand sheets and ${manifest.brands.reduce((n, b) => n + (b.targets?.length ?? 0), 0)} model rows to ${output}`,
);

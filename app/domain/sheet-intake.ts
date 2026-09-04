import { z } from "zod";

import {
  resolvePositioningGroup,
  resolveVocabularySlug,
  splitComplicationTokens,
  splitScenarioTokens,
} from "./catalogue-vocabulary";

export const SHEET_COLUMNS = [
  "Модель / reference",
  "Ссылка производителя",
  "lug2lug, mm",
  "Толщина корпуса, mm",
  "Диаметр корпуса, mm",
  "Форма корпуса",
  "Дно: display-back",
  "Интегрированный браслет",
  "Механизм: тип",
  "Механизм: массовый / мануфактурный (Калибр)",
  "Водозащита",
  "Стекло",
  "Ширина крепления (lug width), mm",
  "Микрорегулировка",
  "Сценарий ношения",
  "Социальный контекст",
  "Complications (Усложнения)",
  "Цена (ориентир Август 2026, USD)",
  "Allergic (риск аллергии)",
] as const;

export const CASE_SHAPES = [
  "round",
  "tonneau",
  "rectangular",
  "cushion",
  "square",
  "oval",
  "other",
] as const;
export type CaseShape = (typeof CASE_SHAPES)[number];

export const microAdjustmentSchema = z
  .object({
    present: z.boolean(),
    systemName: z.string().trim().min(1).max(80).nullable(),
    rangeMm: z.number().positive().max(50).nullable(),
  })
  .strict();
export type MicroAdjustment = z.infer<typeof microAdjustmentSchema>;

const CRYSTALS: Record<string, "sapphire" | "mineral" | "acrylic" | "other"> = {
  сапфир: "sapphire",
  "зеленый сапфир": "sapphire",
  минеральное: "mineral",
  акрил: "acrylic",
  гесалит: "acrylic",
};

const SHAPES: Record<string, CaseShape> = {
  круглая: "round",
  тонно: "tonneau",
  прямоугольная: "rectangular",
  подушка: "cushion",
  квадратная: "square",
  овальная: "oval",
};

const MOVEMENT_TYPES = [
  "automatic",
  "manual",
  "quartz",
  "solar",
  "spring_drive",
  "hybrid",
] as const;

function lower(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ru-RU");
}

export function parseMicroAdjustment(cell: string): MicroAdjustment {
  const text = cell.trim();
  if (text.length === 0) {
    return { present: false, systemName: null, rangeMm: null };
  }
  const parenthetical = text.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const head = (parenthetical?.[1] ?? text).trim();
  const inside = parenthetical?.[2]?.trim() ?? null;
  const absent = lower(head).startsWith("нет");

  if (absent) {
    return { present: false, systemName: inside || null, rangeMm: null };
  }
  const range = inside?.match(/(\d+(?:[.,]\d+)?)/);
  return {
    present: true,
    systemName: head || null,
    rangeMm: range ? Number(range[1]!.replace(",", ".")) : null,
  };
}

export function parseWaterResistanceM(cell: string) {
  const match = cell.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function parseCaseShape(cell: string) {
  const text = lower(cell);
  const integratedHint = /интегрир/.test(text);
  const base = text.replace(/\s*\([^)]*\)\s*/g, "").trim();
  return { shape: SHAPES[base] ?? null, integratedHint };
}

export function parseMovementConstruction(cell: string) {
  const text = cell.trim();
  if (text.length === 0) return { construction: null, caliber: null };
  const parenthetical = text.match(/^(.*?)\s*\(([^)]*)\)\s*$/);
  const head = lower(parenthetical?.[1] ?? text);
  const caliber = parenthetical?.[2]?.trim() || null;
  const construction = head.startsWith("мануфактур")
    ? ("manufacture" as const)
    : head.startsWith("массов")
      ? ("mass_produced" as const)
      : null;
  return { construction, caliber };
}

export function parsePriceUsdMinor(cell: string) {
  const digits = cell.replace(/[^\d.]/g, "");
  if (digits.length === 0) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) && amount > 0
    ? Math.round(amount * 100)
    : null;
}

export function parseAllergyRisk(cell: string) {
  const text = lower(cell);
  if (text === "true") return "possible" as const;
  if (text === "false") return "none_known" as const;
  return null;
}

export function parseYesNo(cell: string) {
  const text = lower(cell);
  if (text === "да" || text === "yes" || text === "true") return true;
  if (text === "нет" || text === "no" || text === "false") return false;
  return null;
}

function parseNumber(cell: string) {
  const match = cell.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

function parseReferenceCode(identity: string) {
  const tokens = identity.trim().split(/\s+/);
  const candidates = tokens.filter((token) =>
    /^M?\d{5,6}[A-Z]*(?:-\d{4})?$/i.test(token),
  );
  const chosen = candidates.at(-1) ?? null;
  return chosen ? chosen.replace(/^M/i, "") : null;
}

export const sheetRowSchema = z
  .object({
    sourceLine: z.number().int().positive(),
    identity: z.string().trim().min(1).max(300),
    referenceCode: z.string().trim().min(1).max(60),
    productUrl: z.url(),
    lugToLugMm: z.number().positive().nullable(),
    caseThicknessMm: z.number().positive().nullable(),
    caseDiameterMm: z.number().positive().nullable(),
    caseShape: z.enum(CASE_SHAPES).nullable(),
    displayCaseback: z.boolean().nullable(),
    integratedBracelet: z.boolean().nullable(),
    movementType: z.enum(MOVEMENT_TYPES),
    movementConstruction: z.enum(["mass_produced", "manufacture"]).nullable(),
    caliber: z.string().trim().min(1).max(80).nullable(),
    waterResistanceM: z.number().nonnegative().nullable(),
    crystal: z.enum(["sapphire", "mineral", "acrylic", "other"]).nullable(),
    lugWidthMm: z.number().positive().nullable(),
    microAdjustment: microAdjustmentSchema,
    wearingScenarios: z.array(z.string().min(1)).min(1),
    positioningLine: z.string().trim().min(1).max(300).nullable(),
    positioningGroup: z.string().min(1).nullable(),
    complications: z.array(z.string().min(1)),
    priceUsdMinor: z.number().int().positive().nullable(),
    nickelContactRisk: z.enum(["none_known", "possible"]).nullable(),
  })
  .strict();

export type SheetRow = z.infer<typeof sheetRowSchema>;

export function parseSheetRow(
  cells: string[],
  sourceLine: number,
): { ok: true; row: SheetRow } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (cells.length !== SHEET_COLUMNS.length) {
    return {
      ok: false,
      reasons: [
        `Line ${sourceLine}: expected 19 columns, received ${cells.length}.`,
      ],
    };
  }

  const at = (index: number) => (cells[index] ?? "").trim();
  const identity = at(0);
  const referenceCode = parseReferenceCode(identity);
  if (!referenceCode) {
    reasons.push(`Line ${sourceLine}: no reference code in "${identity}".`);
  }

  const movementType = lower(at(8));
  if (
    !MOVEMENT_TYPES.includes(movementType as (typeof MOVEMENT_TYPES)[number])
  ) {
    reasons.push(`Line ${sourceLine}: unknown movement type "${at(8)}".`);
  }

  const shape = parseCaseShape(at(5));
  const construction = parseMovementConstruction(at(9));

  const wearingScenarios: string[] = [];
  for (const token of splitScenarioTokens(at(14))) {
    const slug = resolveVocabularySlug("wearing_scenario", token);
    if (slug === null) {
      reasons.push(`Line ${sourceLine}: unmapped wearing scenario "${token}".`);
      continue;
    }
    if (!wearingScenarios.includes(slug)) wearingScenarios.push(slug);
  }
  if (wearingScenarios.length === 0) {
    reasons.push(`Line ${sourceLine}: no wearing scenario resolved.`);
  }

  const complications: string[] = [];
  for (const token of splitComplicationTokens(at(16))) {
    const slug = resolveVocabularySlug("complication", token);
    if (slug === null) {
      reasons.push(`Line ${sourceLine}: unmapped complication "${token}".`);
      continue;
    }
    if (!complications.includes(slug)) complications.push(slug);
  }

  if (reasons.length > 0) return { ok: false, reasons };

  const positioningLine = at(15) || null;
  const parsed = sheetRowSchema.safeParse({
    sourceLine,
    identity,
    referenceCode,
    productUrl: at(1),
    lugToLugMm: parseNumber(at(2)),
    caseThicknessMm: parseNumber(at(3)),
    caseDiameterMm: parseNumber(at(4)),
    caseShape: shape.shape,
    displayCaseback: parseYesNo(at(6)),
    integratedBracelet: parseYesNo(at(7)) ?? shape.integratedHint,
    movementType,
    movementConstruction: construction.construction,
    caliber: construction.caliber,
    waterResistanceM: parseWaterResistanceM(at(10)),
    crystal: CRYSTALS[lower(at(11))] ?? null,
    lugWidthMm: parseNumber(at(12)),
    microAdjustment: parseMicroAdjustment(at(13)),
    wearingScenarios,
    positioningLine,
    positioningGroup: positioningLine
      ? resolvePositioningGroup(positioningLine)
      : null,
    complications,
    priceUsdMinor: parsePriceUsdMinor(at(17)),
    nickelContactRisk: parseAllergyRisk(at(18)),
  });

  return parsed.success
    ? { ok: true, row: parsed.data }
    : {
        ok: false,
        reasons: parsed.error.issues.map(
          (issue) =>
            `Line ${sourceLine}: ${issue.path.join(".")} ${issue.message}`,
        ),
      };
}

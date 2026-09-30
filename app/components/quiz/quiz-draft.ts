/**
 * The quiz's in-browser draft: every answer as typed, saved to
 * sessionStorage between steps, and turned into the exact form fields the
 * server parses.
 */
import type {
  ALLERGY_CONSTRAINTS_V3,
  CRYSTAL_CHOICES,
  MOVEMENT_CONSTRUCTIONS,
} from "../../domain/questionnaire-v3";
import {
  BUDGET_CURRENCIES,
  CASE_DIAMETER_MM_MAX,
  CASE_DIAMETER_MM_MIN,
  caseDiameterForWrist,
  findPriceRange,
  QUESTIONNAIRE_V4_STORAGE_KEY,
  QUESTIONNAIRE_V4_VERSION,
  WRIST_CM_MAX,
  WRIST_CM_MIN,
  type BudgetCurrency,
} from "../../domain/questionnaire-v4";
import type { CaseShape } from "../../domain/sheet-intake";

export type QuizDraft = {
  budgetCurrency: BudgetCurrency;
  priceRange: string;
  wristValue: string;
  wristUnit: "cm" | "in";
  diameterMin: string;
  diameterMax: string;
  wearingScenarios: string[];
  minimumWaterResistanceM: string;
  movementTypes: string[];
  requiredComplications: string[];
  allergyConstraint: (typeof ALLERGY_CONSTRAINTS_V3)[number];
  maxCaseThicknessMm: string;
  caseShape: CaseShape | "";
  movementConstruction: (typeof MOVEMENT_CONSTRUCTIONS)[number] | "";
  displayCaseback: "" | "yes" | "no";
  crystal: (typeof CRYSTAL_CHOICES)[number] | "";
  microAdjustmentRequired: "" | "yes" | "no";
};

export const INITIAL_DRAFT: QuizDraft = {
  budgetCurrency: "USD",
  priceRange: "",
  wristValue: "",
  wristUnit: "cm",
  diameterMin: "",
  diameterMax: "",
  wearingScenarios: [],
  minimumWaterResistanceM: "0",
  movementTypes: [],
  requiredComplications: [],
  allergyConstraint: "none",
  maxCaseThicknessMm: "",
  caseShape: "",
  movementConstruction: "",
  displayCaseback: "",
  crystal: "",
  microAdjustmentRequired: "",
};

export function wristCm(draft: QuizDraft) {
  const value = Number(draft.wristValue);
  if (!draft.wristValue.trim() || !Number.isFinite(value)) return null;
  return (
    Math.round((draft.wristUnit === "in" ? value * 2.54 : value) * 10) / 10
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readSavedDraft(): { step: number; draft: QuizDraft } | null {
  try {
    const raw = window.sessionStorage.getItem(QUESTIONNAIRE_V4_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      parsed.version !== QUESTIONNAIRE_V4_VERSION ||
      !isRecord(parsed.draft)
    ) {
      return null;
    }
    const saved = parsed.draft;
    const text = (key: keyof QuizDraft) =>
      typeof saved[key] === "string" ? saved[key] : "";
    const list = (key: keyof QuizDraft) =>
      Array.isArray(saved[key])
        ? (saved[key] as unknown[]).filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [];
    return {
      step: typeof parsed.step === "number" ? parsed.step : 0,
      draft: {
        ...INITIAL_DRAFT,
        budgetCurrency: (BUDGET_CURRENCIES as readonly string[]).includes(
          text("budgetCurrency"),
        )
          ? (text("budgetCurrency") as BudgetCurrency)
          : INITIAL_DRAFT.budgetCurrency,
        priceRange: findPriceRange(text("priceRange"))
          ? text("priceRange")
          : "",
        wristValue: text("wristValue"),
        wristUnit: text("wristUnit") === "in" ? "in" : "cm",
        diameterMin: text("diameterMin"),
        diameterMax: text("diameterMax"),
        wearingScenarios: list("wearingScenarios"),
        minimumWaterResistanceM: text("minimumWaterResistanceM") || "0",
        movementTypes: list("movementTypes"),
        requiredComplications: list("requiredComplications"),
        allergyConstraint:
          text("allergyConstraint") === "nickel_contact"
            ? "nickel_contact"
            : "none",
        maxCaseThicknessMm: text("maxCaseThicknessMm"),
        caseShape: text("caseShape") as QuizDraft["caseShape"],
        movementConstruction: text(
          "movementConstruction",
        ) as QuizDraft["movementConstruction"],
        displayCaseback: text(
          "displayCaseback",
        ) as QuizDraft["displayCaseback"],
        crystal: text("crystal") as QuizDraft["crystal"],
        microAdjustmentRequired: text(
          "microAdjustmentRequired",
        ) as QuizDraft["microAdjustmentRequired"],
      },
    };
  } catch {
    return null;
  }
}

/** The exact field set the action parses, so a draft posts unchanged. */
export function profileFormFields(draft: QuizDraft) {
  const fields: { name: string; value: string }[] = [
    { name: "version", value: String(QUESTIONNAIRE_V4_VERSION) },
    { name: "budgetCurrency", value: draft.budgetCurrency },
    { name: "priceRange", value: draft.priceRange },
    { name: "wristCm", value: String(wristCm(draft) ?? "") },
    { name: "caseDiameterMinMm", value: draft.diameterMin },
    { name: "caseDiameterMaxMm", value: draft.diameterMax },
    { name: "minimumWaterResistanceM", value: draft.minimumWaterResistanceM },
    { name: "allergyConstraint", value: draft.allergyConstraint },
    { name: "maxCaseThicknessMm", value: draft.maxCaseThicknessMm },
    { name: "caseShape", value: draft.caseShape },
    { name: "movementConstruction", value: draft.movementConstruction },
    { name: "displayCaseback", value: draft.displayCaseback },
    { name: "crystal", value: draft.crystal },
    { name: "microAdjustmentRequired", value: draft.microAdjustmentRequired },
  ];
  for (const value of draft.wearingScenarios)
    fields.push({ name: "wearingScenarios", value });
  for (const value of draft.movementTypes)
    fields.push({ name: "movementTypes", value });
  for (const value of draft.requiredComplications) {
    fields.push({ name: "requiredComplications", value });
  }
  return fields;
}

export function draftToProfileInput(draft: QuizDraft) {
  const optionalNumber = (raw: string) =>
    raw.trim() === "" ? undefined : Number(raw);
  const optionalBoolean = (raw: string) =>
    raw === "" ? undefined : raw === "yes";
  const optionalText = (raw: string) => (raw === "" ? undefined : raw);
  return {
    version: QUESTIONNAIRE_V4_VERSION,
    budgetCurrency: draft.budgetCurrency,
    priceRange: draft.priceRange,
    wristCm: wristCm(draft) ?? Number.NaN,
    caseDiameterMinMm: optionalNumber(draft.diameterMin),
    caseDiameterMaxMm: optionalNumber(draft.diameterMax),
    wearingScenarios: draft.wearingScenarios,
    minimumWaterResistanceM: Number(draft.minimumWaterResistanceM),
    movementTypes: draft.movementTypes,
    requiredComplications: draft.requiredComplications,
    allergyConstraint: draft.allergyConstraint,
    maxCaseThicknessMm: optionalNumber(draft.maxCaseThicknessMm),
    caseShape: optionalText(draft.caseShape),
    movementConstruction: optionalText(draft.movementConstruction),
    displayCaseback: optionalBoolean(draft.displayCaseback),
    crystal: optionalText(draft.crystal),
    microAdjustmentRequired: optionalBoolean(draft.microAdjustmentRequired),
  };
}

/** A wrist change pre-fills the case range; the visitor can then edit it. */
export function wristPatch(
  draft: QuizDraft,
  patch: Pick<QuizDraft, "wristValue"> & Partial<QuizDraft>,
) {
  const next = { ...draft, ...patch };
  const cm = wristCm(next);
  if (cm === null || cm < WRIST_CM_MIN || cm > WRIST_CM_MAX) return patch;
  const suggested = caseDiameterForWrist(cm);
  return {
    ...patch,
    diameterMin: String(suggested.minimumMm),
    diameterMax: String(suggested.maximumMm),
  };
}

/** The edited range when it is complete and sensible, else null. */
export function draftDiameter(draft: QuizDraft) {
  if (draft.diameterMin.trim() === "" && draft.diameterMax.trim() === "")
    return null;
  const minimumMm = Number(draft.diameterMin);
  const maximumMm = Number(draft.diameterMax);
  const inBounds = (value: number) =>
    Number.isFinite(value) &&
    value >= CASE_DIAMETER_MM_MIN &&
    value <= CASE_DIAMETER_MM_MAX;
  if (draft.diameterMin.trim() === "" || draft.diameterMax.trim() === "")
    return "invalid" as const;
  return inBounds(minimumMm) && inBounds(maximumMm) && minimumMm <= maximumMm
    ? { minimumMm, maximumMm }
    : ("invalid" as const);
}

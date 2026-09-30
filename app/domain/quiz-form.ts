/**
 * Reading the quiz's posted form: the flat constraint fields and the
 * optional, explicit email opt-in.
 */
import { z } from "zod";

const emailSchema = z.string().trim().email().max(320);

export function issueMessages(error: { issues: { message: string }[] }) {
  return [...new Set(error.issues.map((issue) => issue.message))];
}

export function parseEmailOptIn(formData: FormData) {
  const emailValue = formData.get("email");
  const optIn = formData.get("emailOptIn");
  const hasEmail = typeof emailValue === "string" && emailValue.trim() !== "";

  if (emailValue !== null && typeof emailValue !== "string") {
    return { error: "The email field is invalid." } as const;
  }
  if (hasEmail && optIn !== "yes") {
    return { error: "Email delivery requires explicit opt-in." } as const;
  }
  if (optIn === "yes" && !hasEmail) {
    return { error: "Enter an email address to request delivery." } as const;
  }
  if (!hasEmail) return { email: null } as const;

  const parsed = emailSchema.safeParse(emailValue);
  return parsed.success
    ? ({ email: parsed.data } as const)
    : ({ error: "Enter a valid email address." } as const);
}

/** Flat form fields: an unchecked box is an absent field, an unset preference "". */
export function parseProfileForm(formData: FormData) {
  const single = (name: string) => {
    const value = formData.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const multiple = (name: string) =>
    formData
      .getAll(name)
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
  const optionalNumber = (raw: string) =>
    raw === "" ? undefined : Number(raw);
  const optionalBoolean = (raw: string) =>
    raw === "" ? undefined : raw === "yes";
  const optionalText = (raw: string) => (raw === "" ? undefined : raw);

  return {
    version: Number(single("version")),
    budgetCurrency: single("budgetCurrency"),
    priceRange: single("priceRange"),
    wristCm: Number(single("wristCm")),
    caseDiameterMinMm: optionalNumber(single("caseDiameterMinMm")),
    caseDiameterMaxMm: optionalNumber(single("caseDiameterMaxMm")),
    wearingScenarios: multiple("wearingScenarios"),
    minimumWaterResistanceM: Number(single("minimumWaterResistanceM")),
    movementTypes: multiple("movementTypes"),
    requiredComplications: multiple("requiredComplications"),
    allergyConstraint: single("allergyConstraint"),
    maxCaseThicknessMm: optionalNumber(single("maxCaseThicknessMm")),
    caseShape: optionalText(single("caseShape")),
    movementConstruction: optionalText(single("movementConstruction")),
    displayCaseback: optionalBoolean(single("displayCaseback")),
    crystal: optionalText(single("crystal")),
    microAdjustmentRequired: optionalBoolean(single("microAdjustmentRequired")),
  };
}

import type { SeedCatalogue } from "./catalogue";
import type { normalizeProfile } from "./questionnaire";
import type { normalizeProfileV3 } from "./questionnaire-v3";
import type {
  EvaluatedCandidate,
  EvaluatedCandidateV3,
  RecommendationResult,
  RecommendationResultV3,
  ScoreFactor,
} from "./recommendation";

type NormalizedProfile = ReturnType<typeof normalizeProfile>;
type NormalizedProfileV3 = ReturnType<typeof normalizeProfileV3>;

export type DossierEmailInput = {
  profile: NormalizedProfile;
  recommendation: RecommendationResult;
};

export type DossierEmailV3Input = {
  profile: NormalizedProfileV3;
  recommendation: RecommendationResultV3;
};

/**
 * The engine-neutral view a dossier renders. Both engines describe the same
 * watch; only the functions line differs, so each adapter renders that line
 * from its own fields.
 */
type DossierCandidate = {
  brand: string;
  model: string;
  variantName: string;
  referenceCode: string;
  productUrl: string;
  primaryArchetype: string;
  score: number;
  price: EvaluatedCandidate["price"];
  geometry: EvaluatedCandidate["geometry"];
  movement: EvaluatedCandidate["movement"];
  functions: string;
  hardReasons: readonly { explanation: string }[];
  missingFacts: readonly { explanation: string }[];
  scoreTrace: readonly ScoreFactor[];
  sourceIds: readonly string[];
};

type DossierRecommendation = {
  evaluatedAt: string;
  sources: SeedCatalogue["sources"];
  diagnostics: RecommendationResult["diagnostics"];
  confirmed: DossierCandidate[];
  verification: DossierCandidate[];
  whyNot: DossierCandidate[];
};

function v2CandidateView(candidate: EvaluatedCandidate): DossierCandidate {
  return {
    ...candidate,
    functions: `${
      candidate.complications.length > 0
        ? candidate.complications.map(label).join(", ")
        : "none listed"
    }; date ${candidate.dateStatus}`,
  };
}

function v3CandidateView(candidate: EvaluatedCandidateV3): DossierCandidate {
  return {
    ...candidate,
    functions:
      candidate.complicationSlugs.length > 0
        ? candidate.complicationSlugs.map(label).join(", ")
        : "none listed",
  };
}

export type DossierEmail = {
  subject: string;
  html: string;
  text: string;
};

const LABELS: Record<string, string> = {
  field_water_abuse: "Field, water, or abuse",
  studio_desk_daily: "Studio, desk, or daily wear",
  formal_architectural: "Formal or architectural",
  zero_maintenance: "Quartz, solar, or digital precision",
  workhorse_mechanical: "Workhorse mechanical",
  specialist_mechanical: "Specialist mechanical",
  seconds_per_month: "Seconds per month",
  within_5_seconds_per_day: "Within ±5 seconds per day",
  within_15_seconds_per_day: "Within ±15 seconds per day",
  no_requirement: "No accuracy requirement",
  under_80_g: "Under 80 g",
  under_120_g: "Under 120 g",
  under_160_g: "Under 160 g",
  no_limit: "No weight limit",
  required: "Date required",
  forbidden: "No date",
  either: "Either is acceptable",
};

function label(value: string) {
  return LABELS[value] ?? value.replaceAll("_", " ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function candidateTitle(candidate: DossierCandidate) {
  return `${candidate.brand} ${candidate.model} — ${candidate.variantName}`;
}

function price(candidate: DossierCandidate) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: candidate.price.currency,
    maximumFractionDigits: 0,
  }).format(candidate.price.amountMinor / 100);
}

function geometry(candidate: DossierCandidate) {
  const dimensions = [
    candidate.geometry.caseDiameterMm !== null
      ? `${candidate.geometry.caseDiameterMm} mm diameter`
      : null,
    candidate.geometry.caseWidthMm !== null &&
    candidate.geometry.caseLengthMm !== null
      ? `${candidate.geometry.caseWidthMm} × ${candidate.geometry.caseLengthMm} mm`
      : null,
    candidate.geometry.caseThicknessMm !== null
      ? `${candidate.geometry.caseThicknessMm} mm thick`
      : null,
    candidate.geometry.lugToLugMm !== null
      ? `${candidate.geometry.lugToLugMm} mm lug-to-lug`
      : null,
    candidate.geometry.weightFullG !== null
      ? `${candidate.geometry.weightFullG} g full-watch weight`
      : null,
  ].filter((part): part is string => part !== null);
  return dimensions.length > 0
    ? dimensions.join("; ")
    : "Geometry not fully verified.";
}

function movement(candidate: DossierCandidate) {
  const parts = [label(candidate.movement.type)];
  if (candidate.movement.caliber) parts.push(candidate.movement.caliber);
  if (candidate.movement.powerReserveHours !== null) {
    parts.push(`${candidate.movement.powerReserveHours} h power reserve`);
  }
  return parts.join(" · ");
}

function sourceEntries(
  candidate: DossierCandidate,
  sources: SeedCatalogue["sources"],
) {
  const ids = new Set(candidate.sourceIds);
  return sources.filter((source) => ids.has(source.id));
}

function candidateText(
  candidate: DossierCandidate,
  sources: SeedCatalogue["sources"],
  status: "confirmed" | "verification" | "whyNot",
) {
  const reasons = [
    ...candidate.hardReasons.map((reason) => reason.explanation),
    ...candidate.missingFacts.map((fact) => fact.explanation),
  ];
  const trace = candidate.scoreTrace.map(
    (factor) =>
      `${factor.factor}: ${factor.points >= 0 ? "+" : ""}${factor.points} — ${factor.explanation}`,
  );
  const sourceLines = sourceEntries(candidate, sources).map(
    (source) => `${source.title} (${source.url})`,
  );
  return [
    `${status === "confirmed" ? "Confirmed fit" : status === "verification" ? "Verify before buying" : "Why it was not selected"}: ${candidateTitle(candidate)}`,
    "The Watch",
    `Reference: ${candidate.referenceCode}`,
    `Price snapshot: ${price(candidate)} (${candidate.price.marketCountry}; observed source currency ${candidate.price.sourceCurrency}; FX observed ${candidate.price.fxObservedAt}).`,
    `Geometry: ${geometry(candidate)}`,
    `Product page: ${candidate.productUrl}`,
    "The Mechanism",
    `Movement: ${movement(candidate)}`,
    `Functions: ${candidate.functions}.`,
    "The Historical Reality",
    "No reviewed historical narrative is attached to this exact reference variant; no brand history or provenance claim is inferred here.",
    "The Psychological Fit",
    `Primary style: ${candidate.primaryArchetype}. Fit score: ${candidate.score}.`,
    ...(trace.length > 0 ? ["Score factors:", ...trace] : []),
    ...(reasons.length > 0
      ? ["Verification or rejection reasons:", ...reasons]
      : []),
    ...(sourceLines.length > 0
      ? ["Reviewed sources:", ...sourceLines]
      : ["Reviewed sources: no source IDs attached."]),
  ].join("\n");
}

function candidateHtml(
  candidate: DossierCandidate,
  sources: SeedCatalogue["sources"],
  status: "confirmed" | "verification" | "whyNot",
) {
  const reasons = [
    ...candidate.hardReasons.map((reason) => reason.explanation),
    ...candidate.missingFacts.map((fact) => fact.explanation),
  ];
  const trace = candidate.scoreTrace.map(
    (factor) =>
      `<li><strong>${escapeHtml(factor.factor)}</strong>: ${factor.points >= 0 ? "+" : ""}${factor.points} — ${escapeHtml(factor.explanation)}</li>`,
  );
  const sourceItems = sourceEntries(candidate, sources).map(
    (source) =>
      `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a> (${escapeHtml(source.publisher)})</li>`,
  );
  return `<article><h3>${escapeHtml(status === "confirmed" ? "Confirmed fit" : status === "verification" ? "Verify before buying" : "Why it was not selected")}: ${escapeHtml(candidateTitle(candidate))}</h3><h4>The Watch</h4><p><strong>Reference:</strong> ${escapeHtml(candidate.referenceCode)}<br><strong>Price snapshot:</strong> ${escapeHtml(price(candidate))} (${escapeHtml(candidate.price.marketCountry)}; source currency ${escapeHtml(candidate.price.sourceCurrency)}; FX observed ${escapeHtml(candidate.price.fxObservedAt)})<br><strong>Geometry:</strong> ${escapeHtml(geometry(candidate))}<br><a href="${escapeHtml(candidate.productUrl)}">Open the reviewed product page</a></p><h4>The Mechanism</h4><p><strong>Movement:</strong> ${escapeHtml(movement(candidate))}<br><strong>Functions:</strong> ${escapeHtml(candidate.functions)}</p><h4>The Historical Reality</h4><p>No reviewed historical narrative is attached to this exact reference variant; no brand history or provenance claim is inferred here.</p><h4>The Psychological Fit</h4><p><strong>Primary style:</strong> ${escapeHtml(candidate.primaryArchetype)}<br><strong>Fit score:</strong> ${candidate.score}</p>${trace.length > 0 ? `<p><strong>Score factors</strong></p><ul>${trace.join("")}</ul>` : ""}${reasons.length > 0 ? `<p><strong>Verification or rejection reasons</strong></p><ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>` : ""}<p><strong>Reviewed sources</strong></p>${sourceItems.length > 0 ? `<ul>${sourceItems.join("")}</ul>` : "<p>No source IDs were attached to this candidate.</p>"}</article>`;
}

function profileLines(profile: NormalizedProfile) {
  const { core, refinement, derived } = profile;
  return [
    `Budget ceiling: ${core.budgetCurrency} ${core.budgetMax.toLocaleString()}; derived band ${label(derived.priceBand)}; effective ceiling ${core.budgetCurrency} ${derived.effectiveBudgetCeiling.toLocaleString()}.`,
    `Wrist: ${core.wristCircumferenceMm} mm (${label(derived.wristBand)}).`,
    `Deployment: ${label(core.deploymentEnvironment)}.`,
    `Ownership: ${label(core.ownershipFriction)}; accuracy: ${label(core.accuracyTolerance)}; weight: ${label(core.weightLimit)}.`,
    `Function: ${core.requiredComplications.length > 0 ? core.requiredComplications.map(label).join(", ") : "no required complication"}; date ${label(core.datePreference)}.`,
    ...(refinement
      ? [
          `Personal preferences were supplied; speculative candidates ${derived.speculativeCandidatesAllowed ? "are allowed with warning" : "are suppressed"}.`,
          ...(refinement.socialSignal
            ? [`Desired perception: ${label(refinement.socialSignal)}.`]
            : []),
          ...(refinement.aestheticDna
            ? [`Visual character: ${label(refinement.aestheticDna)}.`]
            : []),
          ...(refinement.provenancePreference
            ? [
                `Heritage preference: ${label(refinement.provenancePreference)}.`,
              ]
            : []),
          ...(refinement.emotionalObjective
            ? [`Emotional purpose: ${label(refinement.emotionalObjective)}.`]
            : []),
        ]
      : ["No personal preferences were supplied."]),
  ];
}

function profileLinesV3(profile: NormalizedProfileV3) {
  const optional = [
    profile.maxCaseThicknessMm !== undefined
      ? `Thickness limit: ${profile.maxCaseThicknessMm} mm.`
      : null,
    profile.caseShape !== undefined
      ? `Case shape: ${label(profile.caseShape)}.`
      : null,
    profile.movementConstruction !== undefined
      ? `Movement construction: ${label(profile.movementConstruction)}.`
      : null,
    profile.displayCaseback !== undefined
      ? `Caseback: ${profile.displayCaseback ? "display" : "solid"}.`
      : null,
    profile.crystal !== undefined
      ? `Crystal: ${label(profile.crystal)}.`
      : null,
    profile.microAdjustmentRequired !== undefined
      ? `Clasp micro-adjustment: ${profile.microAdjustmentRequired ? "required" : "not wanted"}.`
      : null,
  ].filter((line): line is string => line !== null);

  return [
    `Budget ceiling: ${profile.budgetCurrency} ${profile.budgetMax.toLocaleString()}; derived band ${label(profile.derived.priceBand)}.`,
    `Wearing scenarios: ${profile.wearingScenarios.map(label).join(", ")}.`,
    `Minimum water resistance: ${profile.minimumWaterResistanceM === 0 ? "no requirement" : `${profile.minimumWaterResistanceM} m`}.`,
    `Case diameter: ${profile.caseDiameterMinMm}-${profile.caseDiameterMaxMm} mm.`,
    `Movement types: ${profile.movementTypes.map(label).join(", ")}.`,
    `Required functions: ${profile.requiredComplications.length > 0 ? profile.requiredComplications.map(label).join(", ") : "no required function"}.`,
    `Allergy constraint: ${profile.allergyConstraint === "none" ? "none declared" : "avoid skin-contact nickel"}.`,
    ...(optional.length > 0
      ? optional
      : ["No optional preferences were supplied."]),
  ];
}

function renderDossier(
  lines: string[],
  view: DossierRecommendation,
): DossierEmail {
  const { confirmed, verification, whyNot, sources } = view;
  const textSections = [
    "THE RESERVE — REFERENCE DIAGNOSTIC DOSSIER",
    "",
    "Search boundary",
    ...lines,
    `Evaluated ${view.evaluatedAt}.`,
    "",
    "Historical and prose context",
    "No reviewed historical narrative is attached to this result. The dossier contains only accepted catalogue facts, scored signals, explicit constraints, and source links; it does not infer provenance, collecting meaning, or performance beyond those records.",
    "",
    "Confirmed recommendations",
    confirmed.length > 0
      ? confirmed
          .map((candidate) => candidateText(candidate, sources, "confirmed"))
          .join("\n\n")
      : "No reviewed watch configuration met every non-negotiable requirement.",
    "",
    "Verification queue",
    verification.length > 0
      ? verification
          .map((candidate) => candidateText(candidate, sources, "verification"))
          .join("\n\n")
      : "No candidates require additional verification.",
    "",
    "Why not",
    whyNot.length > 0
      ? whyNot
          .map((candidate) => candidateText(candidate, sources, "whyNot"))
          .join("\n\n")
      : "No rejected candidates were retained in the result set.",
    "",
    "Method boundary",
    `Evaluated ${view.diagnostics.evaluated} watch configurations; ${view.diagnostics.hardRejected} fell outside the stated requirements, ${view.diagnostics.verificationRequired} require verification, and ${view.diagnostics.diversityExcluded} were omitted to keep the result varied.`,
    "The reviewed catalogue does not provide a historical dossier or narrative source for every watch. Missing facts stay visible and are never filled with generated claims.",
  ];

  const section = (heading: string, sectionBody: string) =>
    `<section><h2>${escapeHtml(heading)}</h2>${sectionBody}</section>`;
  const profileHtml = `<ul>${lines
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("")}</ul>`;
  const candidateHtmlFor = (
    candidate: DossierCandidate,
    status: "confirmed" | "verification" | "whyNot",
  ) => candidateHtml(candidate, sources, status);
  const html = `<!doctype html><html><body><main><p><strong>THE RESERVE — REFERENCE DIAGNOSTIC DOSSIER</strong></p>${section("Search boundary", `${profileHtml}<p>Evaluated ${escapeHtml(view.evaluatedAt)}.</p>`)}${section("Historical and prose context", "<p>No reviewed historical narrative is attached to this result. This dossier contains only accepted watch facts, scored signals, explicit constraints, and source links; it does not infer provenance, collecting meaning, or performance beyond those records.</p>")}${section("Confirmed recommendations", confirmed.length > 0 ? confirmed.map((candidate) => candidateHtmlFor(candidate, "confirmed")).join("") : "<p>No reviewed watch configuration met every non-negotiable requirement.</p>")}${section("Verification queue", verification.length > 0 ? verification.map((candidate) => candidateHtmlFor(candidate, "verification")).join("") : "<p>No candidates require additional verification.</p>")}${section("Why not", whyNot.length > 0 ? whyNot.map((candidate) => candidateHtmlFor(candidate, "whyNot")).join("") : "<p>No rejected candidates were retained in the result set.</p>")} ${section("Method boundary", `<p>Evaluated ${view.diagnostics.evaluated} watch configurations; ${view.diagnostics.hardRejected} fell outside the stated requirements, ${view.diagnostics.verificationRequired} require verification, and ${view.diagnostics.diversityExcluded} were omitted to keep the result varied.</p><p>The reviewed collection does not provide a historical dossier or narrative source for every watch. Missing facts stay visible and are never filled with generated claims.</p>`)}</main></body></html>`;

  return {
    subject: "Your Reserve reference diagnostic dossier",
    html,
    text: textSections.join("\n"),
  };
}

export function renderDossierEmail(input: DossierEmailInput): DossierEmail {
  const { profile, recommendation } = input;
  return renderDossier(profileLines(profile), {
    evaluatedAt: recommendation.evaluatedAt,
    sources: recommendation.sources,
    diagnostics: recommendation.diagnostics,
    confirmed: recommendation.recommendations.map(v2CandidateView),
    verification: recommendation.verificationRequired.map(v2CandidateView),
    whyNot: recommendation.whyNot.map(v2CandidateView),
  });
}

export function renderDossierEmailV3(input: DossierEmailV3Input): DossierEmail {
  const { profile, recommendation } = input;
  return renderDossier(profileLinesV3(profile), {
    evaluatedAt: recommendation.evaluatedAt,
    sources: recommendation.sources,
    diagnostics: recommendation.diagnostics,
    confirmed: recommendation.recommendations.map(v3CandidateView),
    verification: recommendation.verificationRequired.map(v3CandidateView),
    whyNot: recommendation.whyNot.map(v3CandidateView),
  });
}

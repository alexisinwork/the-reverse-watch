import type { normalizeProfile } from "./questionnaire";
import type {
  EvaluatedCandidate,
  RecommendationResult,
} from "./recommendation";

type NormalizedProfile = ReturnType<typeof normalizeProfile>;

export type DossierEmailInput = {
  profile: NormalizedProfile;
  recommendation: RecommendationResult;
  catalogueOrigin: "supabase" | "bundled_seed";
  intent: "core" | "refine";
};

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

function candidateTitle(candidate: EvaluatedCandidate) {
  return `${candidate.brand} ${candidate.model} — ${candidate.variantName}`;
}

function price(candidate: EvaluatedCandidate) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: candidate.price.currency,
    maximumFractionDigits: 0,
  }).format(candidate.price.amountMinor / 100);
}

function geometry(candidate: EvaluatedCandidate) {
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

function movement(candidate: EvaluatedCandidate) {
  const parts = [label(candidate.movement.type)];
  if (candidate.movement.caliber) parts.push(candidate.movement.caliber);
  if (candidate.movement.powerReserveHours !== null) {
    parts.push(`${candidate.movement.powerReserveHours} h power reserve`);
  }
  return parts.join(" · ");
}

function sourceEntries(
  candidate: EvaluatedCandidate,
  recommendation: RecommendationResult,
) {
  const ids = new Set(candidate.sourceIds);
  return recommendation.sources.filter((source) => ids.has(source.id));
}

function candidateText(
  candidate: EvaluatedCandidate,
  recommendation: RecommendationResult,
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
  const sources = sourceEntries(candidate, recommendation).map(
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
    `Functions: ${candidate.complications.length > 0 ? candidate.complications.map(label).join(", ") : "none listed"}; date ${candidate.dateStatus}.`,
    "The Historical Reality",
    "No reviewed historical narrative is attached to this exact reference variant; no brand history or provenance claim is inferred here.",
    "The Psychological Fit",
    `Primary catalogue archetype: ${candidate.primaryArchetype}. Deterministic score: ${candidate.score}.`,
    ...(trace.length > 0 ? ["Score factors:", ...trace] : []),
    ...(reasons.length > 0
      ? ["Verification or rejection reasons:", ...reasons]
      : []),
    ...(sources.length > 0
      ? ["Reviewed sources:", ...sources]
      : ["Reviewed sources: no source IDs attached."]),
  ].join("\n");
}

function candidateHtml(
  candidate: EvaluatedCandidate,
  recommendation: RecommendationResult,
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
  const sources = sourceEntries(candidate, recommendation).map(
    (source) =>
      `<li><a href="${escapeHtml(source.url)}">${escapeHtml(source.title)}</a> (${escapeHtml(source.publisher)})</li>`,
  );
  return `<article><h3>${escapeHtml(status === "confirmed" ? "Confirmed fit" : status === "verification" ? "Verify before buying" : "Why it was not selected")}: ${escapeHtml(candidateTitle(candidate))}</h3><h4>The Watch</h4><p><strong>Reference:</strong> ${escapeHtml(candidate.referenceCode)}<br><strong>Price snapshot:</strong> ${escapeHtml(price(candidate))} (${escapeHtml(candidate.price.marketCountry)}; source currency ${escapeHtml(candidate.price.sourceCurrency)}; FX observed ${escapeHtml(candidate.price.fxObservedAt)})<br><strong>Geometry:</strong> ${escapeHtml(geometry(candidate))}<br><a href="${escapeHtml(candidate.productUrl)}">Open the reviewed product page</a></p><h4>The Mechanism</h4><p><strong>Movement:</strong> ${escapeHtml(movement(candidate))}<br><strong>Functions:</strong> ${escapeHtml(candidate.complications.length > 0 ? candidate.complications.map(label).join(", ") : "none listed")}; date ${escapeHtml(candidate.dateStatus)}</p><h4>The Historical Reality</h4><p>No reviewed historical narrative is attached to this exact reference variant; no brand history or provenance claim is inferred here.</p><h4>The Psychological Fit</h4><p><strong>Primary catalogue archetype:</strong> ${escapeHtml(candidate.primaryArchetype)}<br><strong>Deterministic score:</strong> ${candidate.score}</p>${trace.length > 0 ? `<p><strong>Score factors</strong></p><ul>${trace.join("")}</ul>` : ""}${reasons.length > 0 ? `<p><strong>Verification or rejection reasons</strong></p><ul>${reasons.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>` : ""}<p><strong>Reviewed sources</strong></p>${sources.length > 0 ? `<ul>${sources.join("")}</ul>` : "<p>No source IDs were attached to this candidate.</p>"}</article>`;
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
          `Refinement was supplied; speculative candidates ${derived.speculativeCandidatesAllowed ? "are allowed with warning" : "are suppressed"}.`,
        ]
      : ["No optional refinement was supplied."]),
  ];
}

export function renderDossierEmail(input: DossierEmailInput): DossierEmail {
  const { profile, recommendation } = input;
  const confirmed = recommendation.recommendations;
  const verification = recommendation.verificationRequired;
  const whyNot = recommendation.whyNot;
  const textSections = [
    "THE RESERVE — REFERENCE DIAGNOSTIC DOSSIER",
    "",
    "Search boundary",
    ...profileLines(profile),
    `Catalogue: ${input.catalogueOrigin}; engine v${recommendation.engineVersion}; catalogue v${recommendation.catalogueVersion}; evaluated ${recommendation.evaluatedAt}; intent ${input.intent}.`,
    "",
    "Historical and prose context",
    "No reviewed historical narrative is attached to this result. The dossier contains only accepted catalogue facts, scored signals, explicit constraints, and source links; it does not infer provenance, collecting meaning, or performance beyond those records.",
    "",
    "Confirmed recommendations",
    confirmed.length > 0
      ? confirmed
          .map((candidate) =>
            candidateText(candidate, recommendation, "confirmed"),
          )
          .join("\n\n")
      : "No candidate passed every active hard constraint.",
    "",
    "Verification queue",
    verification.length > 0
      ? verification
          .map((candidate) =>
            candidateText(candidate, recommendation, "verification"),
          )
          .join("\n\n")
      : "No candidates require additional verification.",
    "",
    "Why not",
    whyNot.length > 0
      ? whyNot
          .map((candidate) =>
            candidateText(candidate, recommendation, "whyNot"),
          )
          .join("\n\n")
      : "No rejected candidates were retained in the result set.",
    "",
    "Method boundary",
    `Evaluated ${recommendation.diagnostics.evaluated} variants; ${recommendation.diagnostics.hardRejected} were hard-rejected, ${recommendation.diagnostics.verificationRequired} require verification, and ${recommendation.diagnostics.diversityExcluded} were excluded by diversity selection.`,
    "The reviewed catalogue does not provide a historical dossier or narrative source for every watch. Missing facts stay visible and are never filled with generated claims.",
  ];

  const section = (heading: string, body: string) =>
    `<section><h2>${escapeHtml(heading)}</h2>${body}</section>`;
  const profileHtml = `<ul>${profileLines(profile)
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("")}</ul>`;
  const candidateHtmlFor = (
    candidate: EvaluatedCandidate,
    status: "confirmed" | "verification" | "whyNot",
  ) => candidateHtml(candidate, recommendation, status);
  const html = `<!doctype html><html><body><main><p><strong>THE RESERVE — REFERENCE DIAGNOSTIC DOSSIER</strong></p>${section("Search boundary", `${profileHtml}<p>Catalogue: ${escapeHtml(input.catalogueOrigin)}; engine v${recommendation.engineVersion}; catalogue v${recommendation.catalogueVersion}; evaluated ${escapeHtml(recommendation.evaluatedAt)}; intent ${escapeHtml(input.intent)}.</p>`)}${section("Historical and prose context", "<p>No reviewed historical narrative is attached to this result. This dossier contains only accepted catalogue facts, scored signals, explicit constraints, and source links; it does not infer provenance, collecting meaning, or performance beyond those records.</p>")}${section("Confirmed recommendations", confirmed.length > 0 ? confirmed.map((candidate) => candidateHtmlFor(candidate, "confirmed")).join("") : "<p>No candidate passed every active hard constraint.</p>")}${section("Verification queue", verification.length > 0 ? verification.map((candidate) => candidateHtmlFor(candidate, "verification")).join("") : "<p>No candidates require additional verification.</p>")}${section("Why not", whyNot.length > 0 ? whyNot.map((candidate) => candidateHtmlFor(candidate, "whyNot")).join("") : "<p>No rejected candidates were retained in the result set.</p>")} ${section("Method boundary", `<p>Evaluated ${recommendation.diagnostics.evaluated} variants; ${recommendation.diagnostics.hardRejected} were hard-rejected, ${recommendation.diagnostics.verificationRequired} require verification, and ${recommendation.diagnostics.diversityExcluded} were excluded by diversity selection.</p><p>The reviewed catalogue does not provide a historical dossier or narrative source for every watch. Missing facts stay visible and are never filled with generated claims.</p>`)}</main></body></html>`;

  return {
    subject: "Your Reserve reference diagnostic dossier",
    html,
    text: textSections.join("\n"),
  };
}

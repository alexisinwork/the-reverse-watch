import type { AiSearchView, FoundWatch } from "./ai-watch-finder.server";
import type { normalizeProfileV3 } from "./questionnaire-v3";

type NormalizedProfileV3 = ReturnType<typeof normalizeProfileV3>;

export type DossierEmail = {
  subject: string;
  html: string;
  text: string;
};

const LABELS: Record<string, string> = {
  automatic: "Automatic",
  manual: "Hand-wound",
  quartz: "Quartz",
  solar: "Solar",
  spring_drive: "Spring drive",
  hybrid: "Hybrid",
  none: "None declared",
  nickel_contact: "Avoid skin-contact nickel",
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

function profileLines(profile: NormalizedProfileV3) {
  return [
    `Budget ceiling: ${profile.budgetCurrency} ${profile.budgetMax.toLocaleString("en")}.`,
    `Wearing scenarios: ${profile.wearingScenarios.map(label).join(", ")}.`,
    `Minimum water resistance: ${profile.minimumWaterResistanceM === 0 ? "no requirement" : `${profile.minimumWaterResistanceM} m`}.`,
    `Case diameter: ${profile.caseDiameterMinMm}-${profile.caseDiameterMaxMm} mm.`,
    `Movement types: ${profile.movementTypes.map(label).join(", ")}.`,
    `Required functions: ${profile.requiredComplications.length > 0 ? profile.requiredComplications.map(label).join(", ") : "none"}.`,
    `Allergy constraint: ${label(profile.allergyConstraint)}.`,
  ];
}

function watchTitle(watch: FoundWatch) {
  return `${watch.brand} ${watch.model}${watch.referenceCode ? ` (ref. ${watch.referenceCode})` : ""}`;
}

function watchText(watch: FoundWatch, index: number) {
  return [
    `${index + 1}. ${watchTitle(watch)}`,
    ...(watch.priceNote ? [`Price: ${watch.priceNote}`] : []),
    watch.rationale,
    `Source: ${watch.sourceUrl}`,
  ].join("\n");
}

function watchHtml(watch: FoundWatch, index: number) {
  return [
    "<article>",
    watch.imageUrl
      ? `<img src="${escapeHtml(watch.imageUrl)}" alt="${escapeHtml(watchTitle(watch))}" width="240" style="max-width:240px;height:auto">`
      : "",
    `<h3>${index + 1}. ${escapeHtml(watchTitle(watch))}</h3>`,
    watch.priceNote ? `<p><strong>Price:</strong> ${escapeHtml(watch.priceNote)}</p>` : "",
    `<p>${escapeHtml(watch.rationale)}</p>`,
    `<p><a href="${escapeHtml(watch.sourceUrl)}">Open the source</a></p>`,
    "</article>",
  ].join("");
}

const METHOD_NOTE =
  "These watches were found by an AI search of the live web using only the constraints above. Check price, reference, and specifications with the seller before buying.";

export function renderDossierEmail({
  profile,
  aiSearch,
}: {
  profile: NormalizedProfileV3;
  aiSearch: AiSearchView;
}): DossierEmail {
  const lines = profileLines(profile);
  const watches = aiSearch.status === "found" ? aiSearch.watches : [];
  const outcome =
    aiSearch.status === "found"
      ? aiSearch.summary
      : aiSearch.status === "no_match"
        ? `No watch meeting every requirement was found. ${aiSearch.summary}`
        : "The search was unavailable when your diagnostic ran. Run it again for a shortlist.";

  const text = [
    "THE RESERVE — REFERENCE DIAGNOSTIC DOSSIER",
    "",
    "Your search boundary",
    ...lines,
    "",
    "Your shortlist",
    outcome,
    ...watches.map((watch, index) => `\n${watchText(watch, index)}`),
    "",
    METHOD_NOTE,
  ].join("\n");

  const html = `<!doctype html><html><body><main><p><strong>THE RESERVE — REFERENCE DIAGNOSTIC DOSSIER</strong></p><section><h2>Your search boundary</h2><ul>${lines
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join("")}</ul></section><section><h2>Your shortlist</h2><p>${escapeHtml(outcome)}</p>${watches
    .map(watchHtml)
    .join("")}</section><p>${escapeHtml(METHOD_NOTE)}</p></main></body></html>`;

  return { subject: "Your Reserve reference diagnostic dossier", html, text };
}

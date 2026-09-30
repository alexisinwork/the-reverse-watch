import type { AiSearchView, FoundWatch } from "./ai-watch-types";
import {
  caseDiameterForWrist,
  findPriceRange,
  priceRangeLabel,
  type ProfileV4,
} from "./questionnaire-v4";

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

function profileLines(profile: ProfileV4) {
  const diameter = caseDiameterForWrist(profile.wristCm);
  return [
    `Price range: ${priceRangeLabel(findPriceRange(profile.priceRange)!, profile.budgetCurrency)}.`,
    `Wrist: ${profile.wristCm} cm (cases ${diameter.minimumMm}-${diameter.maximumMm} mm).`,
    `Wearing scenarios: ${profile.wearingScenarios.map(label).join(", ")}.`,
    `Minimum water resistance: ${profile.minimumWaterResistanceM === 0 ? "no requirement" : `${profile.minimumWaterResistanceM} m`}.`,
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
    watch.priceNote
      ? `<p><strong>Price:</strong> ${escapeHtml(watch.priceNote)}</p>`
      : "",
    `<p>${escapeHtml(watch.rationale)}</p>`,
    `<p><a href="${escapeHtml(watch.sourceUrl)}">Open the source</a></p>`,
    "</article>",
  ].join("");
}

const METHOD_NOTE =
  "These watches were found with Muse Spark and a live Perplexity web search using only the constraints above, and each reference was confirmed on the manufacturer's or an authorised retailer's page. Check the price with the seller before buying.";

export function renderDossierEmail({
  profile,
  aiSearch,
}: {
  profile: ProfileV4;
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
    .join(
      "",
    )}</ul></section><section><h2>Your shortlist</h2><p>${escapeHtml(outcome)}</p>${watches
    .map(watchHtml)
    .join("")}</section><p>${escapeHtml(METHOD_NOTE)}</p></main></body></html>`;

  return { subject: "Your Reserve reference diagnostic dossier", html, text };
}

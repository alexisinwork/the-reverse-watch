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

const MOVEMENT_WORDS: Record<string, string> = {
  automatic: "automatic",
  manual: "hand-wound",
  quartz: "quartz",
  solar: "solar",
  spring_drive: "Spring Drive",
  hybrid: "hybrid",
};

/** Case size, water resistance and movement, when known. */
function watchFacts(watch: FoundWatch) {
  const details = watch.details;
  return [
    details.caseDiameterMm ? `${details.caseDiameterMm} mm` : null,
    details.waterResistanceM
      ? `${details.waterResistanceM} m water resistance`
      : null,
    details.movement
      ? (MOVEMENT_WORDS[details.movement] ?? details.movement)
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Notes the visitor also saw on the card. */
function watchNotes(watch: FoundWatch) {
  return [
    ...(watch.details.misses ?? []).map(
      (miss) => `Close fit: ${miss.toLowerCase()}.`,
    ),
    watch.details.referenceVerified === true
      ? null
      : "Manufacturer reference not confirmed: check it with the seller.",
  ].filter((note): note is string => note !== null);
}

function watchText(watch: FoundWatch, index: number) {
  const facts = watchFacts(watch);
  return [
    `${index + 1}. ${watchTitle(watch)}`,
    ...(watch.priceNote
      ? [`Price: about ${watch.priceNote} (approximate, may be wrong)`]
      : []),
    ...(facts ? [facts] : []),
    watch.rationale,
    ...watchNotes(watch),
  ].join("\n");
}

const STYLE = {
  body: "margin:0;padding:24px 12px;background:#f4f2ee;color:#1d1f22;font-family:Georgia,'Times New Roman',serif;",
  card: "max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;padding:28px;",
  muted:
    "color:#5b6168;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;",
  text: "font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;",
};

function watchHtml(watch: FoundWatch, index: number) {
  const facts = watchFacts(watch);
  return [
    `<div style="border-top:1px solid #e3e0da;padding:16px 0;">`,
    `<p style="margin:0 0 4px;font-size:17px;"><strong>${index + 1}. ${escapeHtml(watchTitle(watch))}</strong></p>`,
    watch.priceNote
      ? `<p style="margin:0 0 4px;${STYLE.text}">About <strong>${escapeHtml(watch.priceNote)}</strong> <span style="color:#5b6168;">(approximate, may be wrong)</span></p>`
      : "",
    facts
      ? `<p style="margin:0 0 6px;${STYLE.muted}">${escapeHtml(facts)}</p>`
      : "",
    `<p style="margin:0;${STYLE.text}">${escapeHtml(watch.rationale)}</p>`,
    ...watchNotes(watch).map(
      (note) =>
        `<p style="margin:6px 0 0;${STYLE.muted}"><em>${escapeHtml(note)}</em></p>`,
    ),
    "</div>",
  ].join("");
}

const METHOD_NOTE =
  "These watches come from The Reserve's checked catalogue and, where it had gaps, a live web search that used only the answers above. Every price is approximate: check it, and the reference, with the seller before buying.";

function footerLines(sentOn: string) {
  return [
    `You are receiving this email because you asked for your shortlist on thereserve.watch on ${sentOn}. It is a one-off email; we will not send it again.`,
    "Newsletter emails from The Reserve come separately and always include a link to unsubscribe.",
    "The Reserve · https://thereserve.watch · Questions? Just reply to this email.",
    "Privacy policy: https://thereserve.watch/privacy",
  ];
}

export function renderDossierEmail({
  profile,
  aiSearch,
  now = new Date(),
}: {
  profile: ProfileV4;
  aiSearch: AiSearchView;
  now?: Date;
}): DossierEmail {
  const lines = profileLines(profile);
  const watches = aiSearch.status === "found" ? aiSearch.watches : [];
  const outcome =
    aiSearch.status === "found"
      ? aiSearch.summary
      : aiSearch.status === "no_match"
        ? `No watch meeting every requirement was found. ${aiSearch.summary}`
        : "The search was unavailable when your diagnostic ran. Run it again for a shortlist.";
  const sentOn = now.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const text = [
    "Hello,",
    "",
    "Here is the watch shortlist you asked for on The Reserve.",
    "",
    "YOUR ANSWERS",
    ...lines,
    "",
    "YOUR SHORTLIST",
    outcome,
    ...watches.map((watch, index) => `\n${watchText(watch, index)}`),
    "",
    METHOD_NOTE,
    "",
    "--",
    ...footerLines(sentOn),
  ].join("\n");

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Your watch shortlist</title></head><body style="${STYLE.body}"><div style="${STYLE.card}"><p style="margin:0 0 4px;${STYLE.muted}letter-spacing:0.12em;text-transform:uppercase;">The Reserve</p><h1 style="margin:0 0 16px;font-size:24px;font-weight:normal;">Your watch shortlist</h1><p style="margin:0 0 20px;${STYLE.text}">Hello,<br>Here is the watch shortlist you asked for on The Reserve.</p><h2 style="margin:0 0 8px;font-size:17px;">Your answers</h2><ul style="margin:0 0 20px;padding-left:20px;${STYLE.text}">${lines
    .map((line) => `<li>${escapeHtml(line)}</li>`)
    .join(
      "",
    )}</ul><h2 style="margin:0 0 8px;font-size:17px;">Your shortlist</h2><p style="margin:0 0 8px;${STYLE.text}">${escapeHtml(outcome)}</p>${watches
    .map(watchHtml)
    .join(
      "",
    )}<p style="margin:20px 0 0;${STYLE.muted}">${escapeHtml(METHOD_NOTE)}</p></div><div style="max-width:600px;margin:16px auto 0;${STYLE.muted}">${footerLines(
    sentOn,
  )
    .map(
      (line) =>
        `<p style="margin:0 0 6px;">${escapeHtml(line)
          .replace(
            "https://thereserve.watch/privacy",
            '<a href="https://thereserve.watch/privacy" style="color:#5b6168;">thereserve.watch/privacy</a>',
          )
          .replace(
            /https:\/\/thereserve\.watch(?!\/)/,
            '<a href="https://thereserve.watch" style="color:#5b6168;">thereserve.watch</a>',
          )}</p>`,
    )
    .join("")}</div></body></html>`;

  return { subject: "Your watch shortlist from The Reserve", html, text };
}

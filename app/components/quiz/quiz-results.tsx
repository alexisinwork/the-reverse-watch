/** The panels around the shortlist: the answers, story context, email. */
import { useEffect, useState } from "react";
import { Form } from "react-router";

import type { SubscriptionResult } from "../../domain/email-delivery";
import {
  diameterRangeFor,
  findPriceRange,
  priceRangeLabel,
  type ProfileV4,
} from "../../domain/questionnaire-v4";
import { labelFor } from "./labels";
import type { QuizDraft } from "./quiz-draft";
import { ProfileFields } from "./quiz-steps";

export function ProfileSummary({
  profile,
  scenarioLabels,
  complicationLabels,
}: {
  profile: ProfileV4;
  scenarioLabels: Map<string, string>;
  complicationLabels: Map<string, string>;
}) {
  const named = (slugs: readonly string[], labels: Map<string, string>) =>
    slugs.map((slug) => labels.get(slug) ?? labelFor(slug)).join(", ");
  const range = findPriceRange(profile.priceRange)!;
  const diameter = diameterRangeFor(profile);
  const optional = [
    profile.maxCaseThicknessMm !== undefined
      ? ["Thickness", `Up to ${profile.maxCaseThicknessMm} mm`]
      : null,
    profile.caseShape !== undefined
      ? ["Case shape", labelFor(profile.caseShape)]
      : null,
    profile.movementConstruction !== undefined
      ? ["Calibre", labelFor(profile.movementConstruction)]
      : null,
    profile.displayCaseback !== undefined
      ? ["Case back", profile.displayCaseback ? "Display" : "Solid"]
      : null,
    profile.crystal !== undefined
      ? ["Crystal", labelFor(profile.crystal)]
      : null,
    profile.microAdjustmentRequired !== undefined
      ? [
          "Clasp micro-adjustment",
          profile.microAdjustmentRequired ? "Required" : "Not wanted",
        ]
      : null,
  ].filter((entry): entry is [string, string] => entry !== null);
  const rows: [string, string][] = [
    ["Price range", priceRangeLabel(range, profile.budgetCurrency)],
    [
      "Wrist",
      `${profile.wristCm} cm · cases ${diameter.minimumMm}–${diameter.maximumMm} mm`,
    ],
    ["Worn for", named(profile.wearingScenarios, scenarioLabels)],
    [
      "Water resistance",
      profile.minimumWaterResistanceM === 0
        ? "No requirement"
        : `${profile.minimumWaterResistanceM} m or more`,
    ],
    ["Movement", profile.movementTypes.map(labelFor).join(", ")],
    [
      "Must have",
      profile.requiredComplications.length === 0
        ? "Nothing specific"
        : named(profile.requiredComplications, complicationLabels),
    ],
    ["Skin contact", labelFor(profile.allergyConstraint)],
    ...optional,
  ];
  return (
    <dl className="profile-grid">
      {rows.map(([term, value]) => (
        <div key={term}>
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DossierDelivery({
  draft,
  funnelSource,
  subscription,
}: {
  draft: QuizDraft;
  funnelSource: "archetype" | null;
  subscription: SubscriptionResult;
}) {
  return (
    <section className="delivery-panel" aria-labelledby="delivery-heading">
      <span className="eyebrow">Optional</span>
      <h2 id="delivery-heading">Email me this shortlist</h2>
      <p>
        Your results stay here either way. Opt in to receive the shortlist by
        email and The Reserve&apos;s newsletter.
      </p>
      {subscription.status !== "sent" &&
      subscription.status !== "already_requested" ? (
        <Form className="delivery-form" method="post">
          {funnelSource ? (
            <input name="funnelSource" type="hidden" value={funnelSource} />
          ) : null}
          <ProfileFields draft={draft} />
          <label className="input-stack" htmlFor="delivery-email">
            <span>Email address</span>
            <input
              id="delivery-email"
              name="email"
              placeholder="you@example.com"
              type="email"
            />
          </label>
          <label className="delivery-opt-in">
            <input name="emailOptIn" type="checkbox" value="yes" />
            <span>
              I opt in to receive this shortlist by email and, where enabled,
              The Reserve&apos;s email publication.
            </span>
          </label>
          <button className="button button--primary" type="submit">
            Email my shortlist
          </button>
        </Form>
      ) : null}
      {subscription.status !== "not_requested" ? (
        <p
          className={`delivery-status delivery-status--${subscription.status}`}
          role={
            subscription.status === "failed" ||
            subscription.status === "partial"
              ? "alert"
              : "status"
          }
        >
          {subscription.message}
        </p>
      ) : null}
    </section>
  );
}

export function StoryContextPanel({
  storyContext,
}: {
  storyContext: {
    entityName: string;
    workTitle: string | null;
    explanation: Promise<{ message: string }> | { message: string };
  };
}) {
  const [explanation, setExplanation] = useState<{ message: string } | null>(
    null,
  );
  useEffect(() => {
    let active = true;
    void Promise.resolve(storyContext.explanation).then((value) => {
      if (active) setExplanation(value);
    });
    return () => {
      active = false;
    };
  }, [storyContext.explanation]);
  return (
    <section className="delivery-panel" aria-labelledby="story-context-heading">
      <span className="eyebrow">Story context</span>
      <h2 id="story-context-heading">
        {storyContext.entityName}
        {storyContext.workTitle ? ` · ${storyContext.workTitle}` : ""}
      </h2>
      <p>
        {explanation ? explanation.message : "Comparing with your shortlist…"}
      </p>
    </section>
  );
}

/** The panels around the shortlist: the answers, story context, email. */
import { useEffect, useState } from "react";
import { Form, useNavigation } from "react-router";

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
  // The send takes a few seconds: say so instead of looking frozen.
  const navigation = useNavigation();
  const sending =
    navigation.state !== "idle" && navigation.formData?.has("email") === true;
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
              The Reserve&apos;s email publication. See our{" "}
              <a href="/privacy">privacy policy</a>.
            </span>
          </label>
          <button
            aria-busy={sending}
            className="button button--primary"
            disabled={sending}
            type="submit"
          >
            {sending ? "Sending your shortlist…" : "Email my shortlist"}
          </button>
          <p className="delivery-note">
            It usually arrives within a minute. If you don&apos;t see it, check
            your spam or promotions folder and mark it as &ldquo;Not
            spam&rdquo;.
          </p>
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
          {subscription.status === "sent" ||
          subscription.status === "already_requested"
            ? " If it isn't in your inbox within a few minutes, check your spam or promotions folder."
            : null}
        </p>
      ) : null}
    </section>
  );
}

/**
 * A possible future paid product, shown as planned only: there is no
 * payment and nothing to buy yet (owner decision, 2026-10-01).
 */
export function ExpertReportTeaser() {
  return (
    <section
      className="delivery-panel future-panel"
      aria-labelledby="expert-report-heading"
    >
      <span className="future-tag">Coming soon</span>
      <h2 id="expert-report-heading">Expert-reviewed report</h2>
      <p>
        A planned paid add-on: a watch specialist reviews your shortlist and
        writes up real-world prices (retail and pre-owned), what to check before
        buying second-hand, and the best alternatives for your answers.
      </p>
      <p className="delivery-note">
        Not available yet. Subscribers to The Reserve will hear first when it
        launches.
      </p>
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

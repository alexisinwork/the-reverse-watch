/**
 * "Find a cheaper alternative" (subscribers only): name a watch, give a
 * budget, and see watches that look and work like it for less, new or
 * pre-owned. The rules are in app/domain/alternatives.ts.
 */
import { Suspense, useMemo } from "react";
import { Await, Form, redirect, useLoaderData } from "react-router";

import type { Route } from "./+types/watch-alternatives";
import {
  EmbedThemeFields,
  SurfaceLink,
  useEmbed,
  useSearchingHere,
} from "../components/surface";
import { WatchResults } from "../components/watch-results";
import type { ProgressLink } from "../domain/ai-watch-types";
import { ALTERNATIVES_NAME_MAX as NAME_MAX } from "../domain/alternatives";
import {
  readAlternativesForm,
  startAlternativesSearch,
  type AlternativesPage,
} from "../domain/alternatives-search.server";
import { hasDiagnosticAccess } from "../domain/diagnostic-access.server";
import { formatMoney } from "../domain/fx";
import { partnerSiteFrom } from "../domain/partner-embed.server";
import {
  BUDGET_CURRENCIES,
  PRICE_RANGES,
  priceRangeLabel,
} from "../domain/questionnaire-v4";
import { visitorKey } from "../domain/visitor-key.server";
import "../styles/discovery.css";

const EXAMPLES = [
  "Tudor Black Bay 58",
  "Rolex Submariner",
  "Omega Speedmaster Moonwatch",
  "Grand Seiko Snowflake",
];

export async function loader({ request, context }: Route.LoaderArgs) {
  // Partner widgets need no subscription: the partner pays for access.
  const site = partnerSiteFrom(context);
  if (!site && !(await hasDiagnosticAccess(request))) {
    return redirect("/?diagnostic=subscription#newsletter-signup");
  }
  const form = readAlternativesForm(new URL(request.url).searchParams);
  const empty = {
    form,
    error: null as string | null,
    options: [] as { label: string; reference: string; name: string }[],
    page: null as Promise<AlternativesPage> | null,
    progress: null as Promise<ProgressLink | null> | null,
  };
  const search = await startAlternativesSearch(form, {
    rateKey: visitorKey("alternatives", request),
    site,
  });
  switch (search.kind) {
    case "idle":
      return empty;
    case "error":
      return { ...empty, error: search.error };
    case "options":
      return { ...empty, options: search.options };
    case "search":
      return { ...empty, page: search.page, progress: search.progress };
  }
}

export function meta({ data }: Route.MetaArgs) {
  const name = data && "form" in data ? data.form.name : "";
  return [
    {
      title: name
        ? `Alternatives to the ${name} · The Reserve`
        : "Find a cheaper alternative · The Reserve",
    },
    {
      name: "description",
      content:
        "Name a watch and a budget: watches that look and work like it, new or pre-owned from established dealers.",
    },
  ];
}

type LoadedTarget = NonNullable<AlternativesPage["target"]>;

function TargetPanel({ target }: { target: LoadedTarget }) {
  return (
    <section className="alternatives-target" aria-label="The watch you named">
      <span className="eyebrow">Your watch</span>
      <h2>
        {target.card.brand} {target.card.model}
      </h2>
      <p>
        {[
          target.card.referenceCode
            ? `Ref. ${target.card.referenceCode}`
            : null,
          target.card.details.caseDiameterMm
            ? `${target.card.details.caseDiameterMm} mm`
            : null,
          target.card.details.price
            ? `new about ${formatMoney(target.card.details.price.amount, target.card.details.price.currency)}`
            : null,
          target.preowned
            ? `pre-owned from dealers about ${formatMoney(target.preowned.low, target.preowned.currency)}–${formatMoney(target.preowned.high, target.preowned.currency)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>
    </section>
  );
}

export default function WatchAlternatives() {
  const data = useLoaderData<typeof loader>();
  const searching = useSearchingHere();
  const embed = useEmbed();
  const { form, error, options, page, progress } = data;
  // The cards stream in; the "Your watch" panel reads the same answer.
  const resultOf = useMemo(
    () => (page ? page.then((loaded) => loaded.result) : null),
    [page],
  );

  return (
    <main className="discovery-shell find-shell">
      {embed ? null : (
        <nav className="discovery-nav" aria-label="Discovery navigation">
          <SurfaceLink to="/">The Reserve</SurfaceLink>
          <div className="discovery-nav__links">
            <SurfaceLink to="/watches/find">Search the screen</SurfaceLink>
            <SurfaceLink to="/quiz">Reference diagnostic</SurfaceLink>
          </div>
        </nav>
      )}

      <header className="find-hero">
        <span className="eyebrow">
          {embed ? "New or pre-owned" : "Subscriber access"}
        </span>
        <h1>Find a cheaper alternative</h1>
        <p>
          Name a watch you love and your budget. We find watches with the same
          role, functions and size that look as close to it as possible, new or
          pre-owned from established dealers. No homages.
        </p>
        <Form className="alternatives-form" method="get">
          <EmbedThemeFields />
          <div className="field-row">
            <label className="input-stack">
              <span>Watch</span>
              <input
                defaultValue={form.name}
                maxLength={NAME_MAX}
                minLength={2}
                name="name"
                placeholder="e.g. Tudor Black Bay 58"
                required
                type="text"
              />
            </label>
            <label className="input-stack">
              <span>Reference (optional)</span>
              <input
                defaultValue={form.reference}
                maxLength={60}
                name="ref"
                placeholder="e.g. M79030N-0001"
                type="text"
              />
            </label>
          </div>

          <fieldset className="alternatives-fieldset">
            <legend>Budget</legend>
            <label className="alternatives-choice">
              <input
                defaultChecked={form.mode === "exact"}
                name="mode"
                type="radio"
                value="exact"
              />
              <span>Around a price (± 1,000)</span>
            </label>
            <label className="alternatives-choice">
              <input
                defaultChecked={form.mode === "range"}
                name="mode"
                type="radio"
                value="range"
              />
              <span>A price range</span>
            </label>
            <div className="field-row">
              <label className="input-stack">
                <span>Currency</span>
                <select defaultValue={form.currency} name="currency">
                  {BUDGET_CURRENCIES.map((currency) => (
                    <option key={currency}>{currency}</option>
                  ))}
                </select>
              </label>
              <label className="input-stack">
                <span>Price</span>
                <input
                  defaultValue={form.amount}
                  inputMode="numeric"
                  name="amount"
                  placeholder="e.g. 2000"
                  type="text"
                />
              </label>
              <label className="input-stack">
                <span>Or range</span>
                <select defaultValue={form.range} name="range">
                  {PRICE_RANGES.map((range) => (
                    <option key={range.id} value={range.id}>
                      {priceRangeLabel(range)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </fieldset>

          <fieldset className="alternatives-fieldset">
            <legend>Are quartz or solar watches fine?</legend>
            <p className="field-hint">
              Battery and solar watches are cheaper and accurate; mechanical
              ones are what most icons use.
            </p>
            <label className="alternatives-choice">
              <input
                defaultChecked={form.quartz === "yes"}
                name="quartz"
                required
                type="radio"
                value="yes"
              />
              <span>Yes, include them</span>
            </label>
            <label className="alternatives-choice">
              <input
                defaultChecked={form.quartz === "no"}
                name="quartz"
                type="radio"
                value="no"
              />
              <span>No, mechanical only</span>
            </label>
          </fieldset>

          <button
            aria-busy={searching}
            className="button button--primary"
            disabled={searching}
            type="submit"
          >
            {searching ? "Finding alternatives…" : "Find alternatives"}
          </button>
        </Form>
        {error ? (
          <p className="find-error" role="alert">
            {error}
          </p>
        ) : null}
        {options.length > 0 ? (
          <div className="alternatives-options" role="status">
            <p>Which one do you mean?</p>
            <div className="chip-list">
              {options.map((option) => (
                <SurfaceLink
                  className="chip"
                  key={`${option.name}-${option.reference}`}
                  to={`/watches/alternatives?${new URLSearchParams({
                    name: option.name,
                    ref: option.reference,
                    mode: form.mode,
                    amount: form.amount,
                    currency: form.currency,
                    range: form.range,
                    quartz: form.quartz,
                  }).toString()}`}
                >
                  {option.label}
                </SurfaceLink>
              ))}
            </div>
          </div>
        ) : null}
        {!page && options.length === 0 ? (
          <div className="find-examples" aria-label="Example watches">
            <span>Try</span>
            {EXAMPLES.map((example) => (
              <SurfaceLink
                className="chip"
                key={example}
                to={`/watches/alternatives?${new URLSearchParams({ name: example, mode: "exact", amount: "2000", currency: "USD", quartz: "no" }).toString()}`}
              >
                {example}
              </SurfaceLink>
            ))}
          </div>
        ) : null}
      </header>

      {page ? (
        <>
          <Suspense fallback={null}>
            <Await resolve={page}>
              {(loaded) =>
                loaded.target ? <TargetPanel target={loaded.target} /> : null
              }
            </Await>
          </Suspense>
          <WatchResults
            eyebrow="Alternatives · checked watches"
            footnote="Alternatives share the original's role, functions and size; none is a copy of it. Every price is approximate: check it, and the reference, with the seller before buying."
            fx={null}
            heading={`Alternatives to the ${form.name || form.reference}`}
            key={`${form.name}|${form.reference}|${form.mode}|${form.amount}|${form.range}|${form.currency}|${form.quartz}`}
            mode="quiz"
            progress={progress}
            result={resultOf ?? page.then((loaded) => loaded.result)}
          />
        </>
      ) : null}
    </main>
  );
}

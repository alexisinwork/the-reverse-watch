/**
 * "Find a cheaper alternative" (subscribers only): name a watch, give a
 * budget, and see watches that look and work like it for less, new or
 * pre-owned. The rules are in app/domain/alternatives.ts.
 */
import { Suspense, useMemo } from "react";
import {
  Await,
  Form,
  Link,
  redirect,
  useLoaderData,
  useNavigation,
} from "react-router";

import type { Route } from "./+types/watch-alternatives";
import { WatchResults } from "../components/watch-results";
import type { AiSearchView, FoundWatch } from "../domain/ai-watch-types";
import {
  budgetWindow,
  type Alternative,
  type AlternativesBudget,
} from "../domain/alternatives";
import {
  findAlternatives,
  resolveNamedWatch,
  type AlternativesOutcome,
} from "../domain/alternatives.server";
import { createProgressFeed } from "../domain/progress-feed";
import { hasDiagnosticAccess } from "../domain/diagnostic-access.server";
import { formatMoney } from "../domain/fx";
import {
  BUDGET_CURRENCIES,
  PRICE_RANGES,
  priceRangeLabel,
} from "../domain/questionnaire-v4";
import type { RateLimitPolicy } from "../domain/rate-limit.server";
import { consumeSharedRateLimit } from "../domain/rate-limit-upstash.server";
import { visitorKey } from "../domain/visitor-key.server";
import { catalogueToFoundWatch } from "../domain/watch-catalogue";
import {
  catalogueClient,
  loadCatalogueCached,
} from "../domain/watch-catalogue.server";
import "../styles/discovery.css";

const NAME_MAX = 120;

// Pre-owned lookups cost a little, so a visitor's new searches are capped.
const SEARCH_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 20,
  windowMs: 10 * 60 * 1_000,
};

const EXAMPLES = [
  "Tudor Black Bay 58",
  "Rolex Submariner",
  "Omega Speedmaster Moonwatch",
  "Grand Seiko Snowflake",
];

type FormValues = {
  name: string;
  reference: string;
  mode: "exact" | "range";
  amount: string;
  currency: string;
  range: string;
  quartz: "yes" | "no" | "";
};

function readForm(url: URL): FormValues {
  const value = (key: string) => (url.searchParams.get(key) ?? "").trim();
  const currency = value("currency").toUpperCase();
  const quartz = value("quartz");
  return {
    name: value("name").replace(/\s+/g, " ").slice(0, NAME_MAX),
    reference: value("ref").slice(0, 60),
    mode: value("mode") === "range" ? "range" : "exact",
    amount: value("amount").replace(/[^\d.]/g, ""),
    currency: (BUDGET_CURRENCIES as readonly string[]).includes(currency)
      ? currency
      : "USD",
    range: value("range") || "1000_2000",
    quartz: quartz === "yes" || quartz === "no" ? quartz : "",
  };
}

function readBudget(form: FormValues): AlternativesBudget | null {
  if (form.mode === "range") {
    return PRICE_RANGES.some((range) => range.id === form.range)
      ? { kind: "range", rangeId: form.range, currency: form.currency }
      : null;
  }
  const amount = Number(form.amount);
  return Number.isFinite(amount) && amount >= 50 && amount <= 5_000_000
    ? { kind: "exact", amount, currency: form.currency }
    : null;
}

function budgetLabel(budget: AlternativesBudget) {
  if (budget.kind === "exact") {
    return `around ${formatMoney(budget.amount, budget.currency)}`;
  }
  const range = PRICE_RANGES.find((entry) => entry.id === budget.rangeId)!;
  return `for ${priceRangeLabel(range, budget.currency)}`;
}

function asCard(alternative: Alternative): FoundWatch | null {
  const card = catalogueToFoundWatch(alternative.watch);
  if (!card) return null;
  const { shares, differs, price } = alternative;
  return {
    ...card,
    rationale: [
      shares.length > 0 ? `Shares: ${shares.join(", ")}.` : null,
      differs.length > 0 ? `Differs: ${differs.join(", ")}.` : null,
    ]
      .filter(Boolean)
      .join(" "),
    details: {
      ...card.details,
      price: { amount: price.amount, currency: price.currency },
      priceCondition: price.condition,
    },
  };
}

export async function loader({ request }: Route.LoaderArgs) {
  if (!(await hasDiagnosticAccess(request))) {
    return redirect("/?diagnostic=subscription#newsletter-signup");
  }
  const url = new URL(request.url);
  const form = readForm(url);
  const empty = {
    form,
    error: null as string | null,
    options: [] as { label: string; reference: string; name: string }[],
    page: null as Promise<ReturnType<typeof buildPage>> | null,
    progress: null as ReturnType<typeof createProgressFeed>["feed"] | null,
  };
  if (form.name.length < 2 && !form.reference) return empty;

  const budget = readBudget(form);
  if (!budget) {
    return {
      ...empty,
      error: "Enter a price (at least 50) or choose a price range.",
    };
  }
  if (!form.quartz) {
    return {
      ...empty,
      error:
        "Tell us whether quartz or solar watches are fine before we search.",
    };
  }
  const client = catalogueClient();
  if (!client)
    return { ...empty, error: "The search is unavailable right now." };
  const catalogue = await loadCatalogueCached(client);
  const resolved = resolveNamedWatch(
    catalogue,
    form.name,
    form.reference || null,
  );
  if (resolved.status === "ambiguous") {
    return {
      ...empty,
      options: resolved.options.map((watch) => ({
        label: `${watch.brand} ${watch.model}${watch.caseDiameterMm ? ` · ${watch.caseDiameterMm} mm` : ""}`,
        reference: watch.referenceCode ?? "",
        name: `${watch.brand} ${watch.model}`,
      })),
    };
  }
  if (
    !(
      await consumeSharedRateLimit(
        visitorKey("alternatives", request),
        SEARCH_POLICY,
      )
    ).allowed
  ) {
    return {
      ...empty,
      error:
        "You have run a lot of searches in a short time. Please try again in a few minutes.",
    };
  }

  // Catalogue answers come back at once; a live web search (an unknown
  // watch, or too few matches) streams its steps while it runs.
  const progress = createProgressFeed(120_000);
  const page = findAlternatives({
    target: resolved.status === "found" ? resolved.watch : null,
    name: form.name,
    reference: form.reference || null,
    budget,
    allowQuartz: form.quartz === "yes",
    report: progress.report,
  })
    .then((outcome) => buildPage(outcome, budget, form))
    .catch(() => ({
      target: null,
      result: { status: "unavailable" } as AiSearchView,
    }));
  void page.finally(progress.close);
  return { ...empty, page, progress: progress.feed };
}

function buildPage(
  outcome: AlternativesOutcome,
  budget: AlternativesBudget,
  form: FormValues,
) {
  if (outcome.status === "not_found") {
    return {
      target: null,
      result: {
        status: "no_match",
        summary: `We couldn't identify “${form.name}”, in our catalogue or on the web. Check the spelling, or add its reference.`,
      } as AiSearchView,
    };
  }
  const { target, alternatives, searchedLive } = outcome;
  const cards = alternatives
    .map(asCard)
    .filter((card): card is FoundWatch => card !== null);
  const window = budgetWindow(budget);
  const result: AiSearchView =
    cards.length > 0
      ? {
          status: "found",
          fromCache: !searchedLive,
          origin: searchedLive ? "mixed" : "catalogue",
          watches: cards,
          summary: `${cards.length} ${cards.length === 1 ? "watch" : "watches"} like the ${target.brand} ${target.model} ${budgetLabel(budget)}, most alike first. Same role, functions and size; ranked by how closely the dial, hands, bezel and finish match.`,
        }
      : {
          status: "no_match",
          summary: `No watch is close enough to the ${target.brand} ${target.model} ${budgetLabel(budget)} (${formatMoney(window.minimum, window.currency)}–${window.maximum === null ? "more" : formatMoney(window.maximum, window.currency)}). Try a wider budget${form.quartz === "no" ? ", or allow quartz and solar watches" : ""}.`,
        };
  const targetCard = catalogueToFoundWatch(target);
  return {
    target: targetCard
      ? { card: targetCard, preowned: target.preownedPrice ?? null }
      : null,
    result,
  };
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

type LoadedTarget = NonNullable<
  Awaited<ReturnType<typeof buildPage>>["target"]
>;

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
  const navigation = useNavigation();
  const searching =
    navigation.state === "loading" &&
    navigation.location?.pathname === "/watches/alternatives";
  const { form, error, options, page, progress } = data;
  // The cards stream in; the "Your watch" panel reads the same answer.
  const resultOf = useMemo(
    () => (page ? page.then((loaded) => loaded.result) : null),
    [page],
  );

  return (
    <main className="discovery-shell find-shell">
      <nav className="discovery-nav" aria-label="Discovery navigation">
        <Link to="/">The Reserve</Link>
        <div className="discovery-nav__links">
          <Link to="/watches/find">Search the screen</Link>
          <Link to="/quiz">Reference diagnostic</Link>
        </div>
      </nav>

      <header className="find-hero">
        <span className="eyebrow">Subscriber access</span>
        <h1>Find a cheaper alternative</h1>
        <p>
          Name a watch you love and your budget. We find watches with the same
          role, functions and size that look as close to it as possible, new or
          pre-owned from established dealers. No homages.
        </p>
        <Form className="alternatives-form" method="get">
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
                <Link
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
                </Link>
              ))}
            </div>
          </div>
        ) : null}
        {!page && options.length === 0 ? (
          <div className="find-examples" aria-label="Example watches">
            <span>Try</span>
            {EXAMPLES.map((example) => (
              <Link
                className="chip"
                key={example}
                to={`/watches/alternatives?${new URLSearchParams({ name: example, mode: "exact", amount: "2000", currency: "USD", quartz: "no" }).toString()}`}
              >
                {example}
              </Link>
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

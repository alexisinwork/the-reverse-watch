/**
 * The cheaper-alternative search behind /watches/alternatives, its partner
 * widget and the public API: reading the request, resolving the named
 * watch, and the finished page (the target and the alternatives). The
 * matching rules are in alternatives.ts.
 */
import type { AiSearchView, FoundWatch } from "./ai-watch-types";
import {
  ALTERNATIVES_NAME_MAX,
  budgetWindow,
  type Alternative,
  type AlternativesBudget,
} from "./alternatives";
import {
  findAlternatives,
  resolveNamedWatch,
  type AlternativesOutcome,
} from "./alternatives.server";
import { formatMoney } from "./fx";
import { meterPartnerUse } from "./partner-embed.server";
import type { PartnerSite } from "./partner-sites.server";
import { createProgressFeed } from "./progress-feed";
import {
  BUDGET_CURRENCIES,
  PRICE_RANGES,
  priceRangeLabel,
} from "./questionnaire-v4";
import type { RateLimitPolicy } from "./rate-limit.server";
import { consumeSharedRateLimit } from "./rate-limit-upstash.server";
import { catalogueToFoundWatch } from "./watch-catalogue";
import { catalogueClient, loadCatalogueCached } from "./watch-catalogue.server";

// Pre-owned lookups cost a little, so a visitor's new searches are capped.
export const ALTERNATIVES_SEARCH_POLICY: RateLimitPolicy = {
  configured: true,
  maxRequests: 20,
  windowMs: 10 * 60 * 1_000,
};

export type AlternativesForm = {
  name: string;
  reference: string;
  mode: "exact" | "range";
  amount: string;
  currency: string;
  range: string;
  quartz: "yes" | "no" | "";
};

export function readAlternativesForm(
  params: URLSearchParams,
): AlternativesForm {
  const value = (key: string) => (params.get(key) ?? "").trim();
  const currency = value("currency").toUpperCase();
  const quartz = value("quartz");
  return {
    name: value("name").replace(/\s+/g, " ").slice(0, ALTERNATIVES_NAME_MAX),
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

function readBudget(form: AlternativesForm): AlternativesBudget | null {
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

function buildAlternativesPage(
  outcome: AlternativesOutcome,
  budget: AlternativesBudget,
  form: AlternativesForm,
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

export type AlternativesPage = ReturnType<typeof buildAlternativesPage>;

export type AlternativesSearch =
  | { kind: "idle" }
  | {
      kind: "error";
      error: string;
      code:
        "invalid_request" | "monthly_limit" | "rate_limited" | "unavailable";
    }
  | {
      kind: "options";
      options: { label: string; reference: string; name: string }[];
    }
  | {
      kind: "search";
      page: Promise<AlternativesPage>;
      progress: ReturnType<typeof createProgressFeed>["feed"];
    };

/**
 * Validates the request, resolves the named watch and starts the search.
 * `rateKey` limits one visitor (or one partner's server); a partner site's
 * use is counted once the search really starts.
 */
export async function startAlternativesSearch(
  form: AlternativesForm,
  {
    rateKey,
    policy = ALTERNATIVES_SEARCH_POLICY,
    site = null,
  }: { rateKey: string; policy?: RateLimitPolicy; site?: PartnerSite | null },
): Promise<AlternativesSearch> {
  if (form.name.length < 2 && !form.reference) return { kind: "idle" };

  const budget = readBudget(form);
  if (!budget) {
    return {
      kind: "error",
      code: "invalid_request",
      error: "Enter a price (at least 50) or choose a price range.",
    };
  }
  if (!form.quartz) {
    return {
      kind: "error",
      code: "invalid_request",
      error:
        "Tell us whether quartz or solar watches are fine before we search.",
    };
  }
  const client = catalogueClient();
  if (!client)
    return {
      kind: "error",
      code: "unavailable",
      error: "The search is unavailable right now.",
    };
  const catalogue = await loadCatalogueCached(client);
  const resolved = resolveNamedWatch(
    catalogue,
    form.name,
    form.reference || null,
  );
  if (resolved.status === "ambiguous") {
    return {
      kind: "options",
      options: resolved.options.map((watch) => ({
        label: `${watch.brand} ${watch.model}${watch.caseDiameterMm ? ` · ${watch.caseDiameterMm} mm` : ""}`,
        reference: watch.referenceCode ?? "",
        name: `${watch.brand} ${watch.model}`,
      })),
    };
  }
  const limitMessage = await meterPartnerUse(site, "alternatives");
  if (limitMessage)
    return { kind: "error", code: "monthly_limit", error: limitMessage };
  if (!(await consumeSharedRateLimit(rateKey, policy)).allowed) {
    return {
      kind: "error",
      code: "rate_limited",
      error:
        "You have run a lot of searches in a short time. Please try again in a few minutes.",
    };
  }

  // Catalogue answers come back at once; a live web search (an unknown
  // watch, or too few matches) streams its steps while it runs.
  const progress = createProgressFeed(110_000);
  const page = findAlternatives({
    target: resolved.status === "found" ? resolved.watch : null,
    name: form.name,
    reference: form.reference || null,
    budget,
    allowQuartz: form.quartz === "yes",
    report: progress.report,
  })
    .then((outcome) => buildAlternativesPage(outcome, budget, form))
    .catch(() => ({
      target: null,
      result: { status: "unavailable" } as AiSearchView,
    }));
  void page.finally(progress.close);
  return { kind: "search", page, progress: progress.feed };
}

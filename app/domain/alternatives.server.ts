/**
 * The cheaper-alternative finder on the server: identify the watch the
 * subscriber named, fetch pre-owned prices where they could bring a match
 * into budget, and rank alternatives with the rules in alternatives.ts.
 */
import { defaultDeps } from "./ai-providers.server";
import { normalizeReference } from "./ai-watch-guardrails";
import {
  budgetWindow,
  rankAlternatives,
  strictFailures,
  type AlternativesBudget,
} from "./alternatives";
import { loadFxTable } from "./fx.server";
import { lookupPreownedPrice } from "./preowned-price.server";
import { priceIn, type CatalogueWatch } from "./watch-catalogue";
import {
  catalogueClient,
  loadCatalogueCached,
  recordPreownedPrice,
} from "./watch-catalogue.server";

const fold = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const WORD_ALIASES: Record<string, string> = { fifty: "58", eight: "" };

function words(value: string) {
  return fold(value)
    .split(" ")
    .map((word) => WORD_ALIASES[word] ?? word)
    .filter(
      (word) => word.length > 0 && !["the", "watch", "mm"].includes(word),
    );
}

/** A model's family name, so colour variants count as one watch. */
function family(watch: CatalogueWatch) {
  return fold(`${watch.brand} ${watch.model}`)
    .replace(
      /\b(black|blue|white|green|silver|grey|gray|red|gilt|steel|bracelet|strap|leather|rubber|dial)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

const better = (a: CatalogueWatch, b: CatalogueWatch) =>
  Number(b.reviewStatus === "approved") -
    Number(a.reviewStatus === "approved") ||
  Number(b.referenceConfirmed) - Number(a.referenceConfirmed) ||
  Number(Boolean(b.designTraits)) - Number(Boolean(a.designTraits));

export type ResolvedWatch =
  | { status: "found"; watch: CatalogueWatch }
  | { status: "ambiguous"; options: CatalogueWatch[] }
  | { status: "not_found" };

/**
 * The catalogue watch the subscriber means. A reference wins; otherwise
 * every word they typed must appear. Several different models matching is
 * "ambiguous" (the page asks "Did you mean…?"); near misses (one word off,
 * like "Black Bay 51") are offered the same way, never picked silently.
 */
export function resolveNamedWatch(
  catalogue: readonly CatalogueWatch[],
  name: string,
  reference: string | null,
): ResolvedWatch {
  const live = catalogue.filter((watch) => watch.reviewStatus !== "rejected");
  const ref = normalizeReference(reference);
  if (ref) {
    const byRef = live.filter(
      (watch) => normalizeReference(watch.referenceCode) === ref,
    );
    if (byRef.length > 0)
      return { status: "found", watch: [...byRef].sort(better)[0]! };
  }
  const wanted = words(name);
  if (wanted.length === 0) return { status: "not_found" };
  const haystack = (watch: CatalogueWatch) =>
    ` ${words(`${watch.brand} ${watch.model} ${watch.referenceCode ?? ""}`).join(" ")} `;
  const hits = (watch: CatalogueWatch) =>
    wanted.filter(
      (word) =>
        haystack(watch).includes(` ${word} `) ||
        haystack(watch).includes(` ${word}`),
    ).length;

  const full = live.filter((watch) => hits(watch) === wanted.length);
  // A near miss (one word off, like "Black Bay 51") must still share a
  // model word, not just the brand: "Patek Philippe Nautilus" must not
  // offer a Calatrava.
  const nearMiss = (watch: CatalogueWatch) => {
    if (wanted.length < 3 || hits(watch) !== wanted.length - 1) return false;
    const brandWords = new Set(words(watch.brand));
    const modelWords = ` ${words(watch.model).join(" ")} `;
    return wanted.some(
      (word) => !brandWords.has(word) && modelWords.includes(` ${word} `),
    );
  };
  const pool = full.length > 0 ? full : live.filter(nearMiss);
  if (pool.length === 0) return { status: "not_found" };

  const byFamily = new Map<string, CatalogueWatch[]>();
  for (const watch of pool) {
    byFamily.set(family(watch), [
      ...(byFamily.get(family(watch)) ?? []),
      watch,
    ]);
  }
  const options = [...byFamily.entries()]
    .map(([key, group]) => ({ key, watch: [...group].sort(better)[0]! }))
    .sort((a, b) => a.key.length - b.key.length);
  if (full.length > 0) {
    // Exactly the name typed, or the plain base model every other match
    // extends (Submariner vs Submariner Date): take it without asking.
    const typed = wanted.join(" ");
    const exact = options.find((option) => option.key === typed);
    if (exact) return { status: "found", watch: exact.watch };
    const base = options[0]!;
    if (options.every((option) => option.key.startsWith(base.key))) {
      return { status: "found", watch: base.watch };
    }
  }
  return {
    status: "ambiguous",
    options: options.slice(0, 6).map((option) => option.watch),
  };
}

const PREOWNED_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1_000;
const PREOWNED_LOOKUPS_PER_SEARCH = 6;

const preownedFresh = (watch: CatalogueWatch, now: number) =>
  watch.preownedPrice !== null &&
  watch.preownedPrice !== undefined &&
  now - Date.parse(watch.preownedPrice.checkedAt) < PREOWNED_MAX_AGE_MS;

/**
 * Looks up pre-owned prices for the named watch and for the best strict
 * matches that are too dear new but could be in budget used (new price at
 * most twice the budget). Results are stored for 90 days.
 */
async function fillPreownedPrices(
  target: CatalogueWatch,
  catalogue: readonly CatalogueWatch[],
  budget: AlternativesBudget,
  allowQuartz: boolean,
) {
  const client = catalogueClient();
  const deps = defaultDeps();
  if (!client || !deps.config.perplexity) return;
  const fx = await loadFxTable();
  const window = budgetWindow(budget);
  const now = Date.now();
  const ceiling = window.maximum === null ? null : window.maximum * 2;
  const candidates = catalogue
    .filter((watch) => {
      if (watch.id === target.id || preownedFresh(watch, now)) return false;
      if (strictFailures(target, watch, allowQuartz).length > 0) return false;
      const fresh = priceIn(watch, window.currency, fx);
      return (
        fresh !== null &&
        window.maximum !== null &&
        fresh > window.maximum &&
        ceiling !== null &&
        fresh <= ceiling
      );
    })
    .slice(0, PREOWNED_LOOKUPS_PER_SEARCH - 1);
  const todo = preownedFresh(target, now)
    ? candidates
    : [target, ...candidates];
  await Promise.allSettled(
    todo.map(async (watch) => {
      const price = await lookupPreownedPrice(watch, deps, fx);
      if (price) await recordPreownedPrice(client, watch.id, price);
    }),
  );
}

export async function findAlternatives({
  target,
  budget,
  allowQuartz,
}: {
  target: CatalogueWatch;
  budget: AlternativesBudget;
  allowQuartz: boolean;
}) {
  const client = catalogueClient();
  if (!client) throw new Error("The catalogue is not configured.");
  let catalogue = await loadCatalogueCached(client);
  await fillPreownedPrices(target, catalogue, budget, allowQuartz).catch(
    () => undefined,
  );
  // Re-read so freshly stored pre-owned prices count.
  catalogue = await loadCatalogueCached(client);
  const fx = await loadFxTable();
  const fresh = catalogue.find((watch) => watch.id === target.id) ?? target;
  return {
    target: fresh,
    alternatives: rankAlternatives(fresh, catalogue, budget, allowQuartz, fx),
    fx,
  };
}

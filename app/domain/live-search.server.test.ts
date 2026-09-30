import { vi } from "vitest";

import { collectUntilDeadline, quizCacheInput, quizConstraintLines, searchQuizWatches } from "./quiz-live-search.server";
import { runSafely, type Deps } from "./ai-providers.server";
import { searchFilmWatches } from "./film-search.server";
import type { FxTable } from "./fx";
import type { ProfileV4 } from "./questionnaire-v4";

const profile: ProfileV4 = {
  version: 4,
  budgetCurrency: "EUR",
  priceRange: "3000_4000",
  wristCm: 17.5,
  wearingScenarios: ["office", "everyday"],
  minimumWaterResistanceM: 100,
  movementTypes: ["automatic"],
  requiredComplications: [],
  allergyConstraint: "none",
};

const config: Deps["config"] = {
  museSpark: { apiKey: "muse", baseUrl: "https://muse.test/v1/", fastModel: "fast" },
  perplexity: { apiKey: "pplx", model: "sonar" },
  webSearch: "perplexity",
};

const fx: FxTable = { date: "2026-09-29", perEur: { EUR: 1, USD: 1.1355, GBP: 0.85718 } };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function candidate(overrides: Record<string, unknown> = {}) {
  return {
    brand: "Longines",
    model: "Spirit 40",
    referenceCode: "L3.810.4.73.6",
    priceAmount: 3_350,
    priceCurrency: "EUR",
    waterResistanceM: 100,
    caseDiameterMm: 40,
    movementType: "Automatic",
    caseMaterial: "Stainless steel",
    casebackMaterial: "Stainless steel",
    strapMaterial: "Steel bracelet",
    why: "Versatile pilot style.",
    ...overrides,
  };
}

type Script = {
  muse?: unknown[][];
  live?: unknown[];
  pages?: Record<string, string>;
  /** Overrides the manufacturer URL the search returns for a query. */
  searchUrl?: (query: string) => string;
};

function network(script: Script) {
  let museCall = 0;
  const bodies: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    bodies.push(String(init?.body ?? ""));
    if (url.startsWith("https://muse.test/")) {
      const request = JSON.parse(String(init?.body)) as { messages: { content: string }[] };
      if (request.messages[0]!.content.includes("film and culture editor")) {
        return json({ choices: [{ message: { content: JSON.stringify({ order: [{ index: 1, note: "Second first." }, { index: 0, note: "Then first." }], summary: "Two sightings." }) } }] });
      }
      const candidates = script.muse?.[museCall++] ?? [];
      return json({ choices: [{ message: { content: JSON.stringify({ candidates }) } }] });
    }
    if (url === "https://api.perplexity.ai/chat/completions") {
      const prompt = (JSON.parse(String(init?.body)) as { messages: { content: string }[] }).messages[0]!.content;
      if (prompt.includes("The subject may be")) {
        return json({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  sightings: [
                    { brand: "Omega", model: "Seamaster Diver 300M", referenceCode: "210.90.42.20.01.001", person: "Daniel Craig", work: "No Time to Die", year: 2021, context: "Worn as Bond.", evidenceUrl: "https://www.hodinkee.com/bond", manufacturerUrl: "https://www.omegawatches.com/210-90" },
                    { brand: "Omega", model: "Unknown Omega", referenceCode: null, person: "Daniel Craig", work: null, year: null, context: "?", evidenceUrl: "https://www.esquire.com/x", manufacturerUrl: null },
                    { brand: "Rolex", model: "Submariner", referenceCode: null, person: "Daniel Craig", work: null, year: null, context: "Forum claim.", evidenceUrl: "https://www.reddit.com/r/watches/1", manufacturerUrl: null },
                    { brand: "Omega", model: "Planet Ocean", referenceCode: "2900.50.91", person: "Daniel Craig", work: "Casino Royale", year: 2006, context: "Worn as Bond.", evidenceUrl: "https://www.watch-id.com/po", manufacturerUrl: null },
                  ],
                }),
              },
            },
          ],
        });
      }
      return json({ choices: [{ message: { content: JSON.stringify({ candidates: script.live ?? [] }) } }] });
    }
    if (url === "https://api.perplexity.ai/search") {
      const queries = (JSON.parse(String(init?.body)) as { query: string[] }).query;
      return json({
        results: queries.map((query) => {
          const reference = query.split(" ").slice(1).join(" ");
          const slug = reference.toLowerCase().replace(/[^a-z0-9]/g, "-");
          const brand = query.split(" ")[0]!.toLowerCase();
          const url = script.searchUrl?.(query) ?? `https://www.${brand}.com/p/${slug}`;
          return { url, title: `${query}`, snippet: reference };
        }),
      });
    }
    if (url.startsWith("https://img.test/")) {
      return new Response(null, { status: 206, headers: { "content-type": "image/jpeg" } });
    }
    const page = script.pages?.[url];
    if (page !== undefined) return new Response(page, { status: 200, headers: { "content-type": "text/html" } });
    if (url.includes(".com/p/")) {
      return new Response(`<meta property="og:image" content="https://img.test/${encodeURIComponent(url)}.jpg">ref ${url.split("/p/")[1]}`, { status: 200 });
    }
    return new Response("not found", { status: 404 });
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, bodies };
}

function deps(script: Script): Partial<Deps> & { bodies: string[] } {
  const { fetchImpl, bodies } = network(script);
  return { config, fetchImpl, loadFx: async () => fx, sleep: async () => undefined, bodies };
}

describe("searchQuizWatches", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("returns watches that pass every rule and are confirmed on a manufacturer page", async () => {
    const setup = deps({
      muse: [
        [candidate(), candidate({ brand: "Tudor", model: "Black Bay 41", referenceCode: "M79540-0006", priceAmount: 2_290 })],
        [candidate({ brand: "Nomos", model: "Club Sport", referenceCode: "781", priceAmount: 3_780, caseDiameterMm: 42 })],
        [candidate({ brand: "Oris", model: "Aquis", referenceCode: "01 400 7769 4135", waterResistanceM: 50 })],
      ],
    });

    const result = await searchQuizWatches(profile, setup);

    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("expected watches");
    // Tudor breaks the price range and Oris the water resistance.
    expect(result.watches.map((watch) => watch.brand)).toEqual(["Longines", "Nomos"]);
    expect(result.watches[0]).toMatchObject({
      referenceCode: "L3.810.4.73.6",
      sourceUrl: "https://www.longines.com/p/l3-810-4-73-6",
      priceNote: "EUR 3,350",
      rationale: "Versatile pilot style.",
      details: { sourceKind: "manufacturer", referenceVerified: true },
    });
    expect(result.watches[0]!.imageUrl).toMatch(/^https:\/\/img\.test\//);
  });

  it("converts foreign prices with ECB rates before the range check", async () => {
    const setup = deps({
      muse: [[candidate({ priceAmount: 3_900, priceCurrency: "USD" })], [], []],
    });

    const result = await searchQuizWatches(profile, setup);

    // USD 3,900 is about EUR 3,435, inside the EUR 3,000-4,000 range.
    expect(result.status).toBe("found");
  });

  it("drops a watch when neither its page nor its URL shows the reference", async () => {
    const setup = deps({
      muse: [[candidate()], [], []],
      searchUrl: () => "https://www.longines.com/watches/spirit",
      pages: { "https://www.longines.com/watches/spirit": "<html>a different watch</html>" },
    });

    expect((await searchQuizWatches(profile, setup)).status).toBe("no_match");
  });

  it("applies the no-steel rule for a nickel allergy", async () => {
    const setup = deps({
      muse: [
        [
          candidate(),
          candidate({
            brand: "Hamilton",
            model: "Khaki Field Titanium",
            referenceCode: "H70205830",
            caseMaterial: "Titanium",
            casebackMaterial: "Titanium",
            strapMaterial: "Leather strap",
          }),
        ],
        [],
        [],
      ],
    });

    const result = await searchQuizWatches(
      { ...profile, allergyConstraint: "nickel_contact" },
      setup,
    );

    if (result.status !== "found") throw new Error("expected watches");
    expect(result.watches.map((watch) => watch.brand)).toEqual(["Hamilton"]);
  });

  it("sends only constraints, never visitor identity, to either AI", async () => {
    const setup = deps({ muse: [[candidate()], [], []] });
    await searchQuizWatches(profile, setup);
    const outbound = setup.bodies.join("\n");
    expect(outbound).toContain("EUR 3,000 and EUR 4,000");
    expect(outbound).not.toMatch(/@|cookie|session/i);
  });

  it("is unavailable without both providers configured", async () => {
    expect(
      await searchQuizWatches(profile, { ...deps({}), config: { museSpark: null, perplexity: null, webSearch: "perplexity" } }),
    ).toEqual({ status: "unavailable" });
  });
});

describe("searchFilmWatches", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps documented sightings, drops vague and forum ones, and follows Muse's order", async () => {
    const result = await searchFilmWatches("Daniel Craig", deps({}));

    expect(result.status).toBe("found");
    if (result.status !== "found") throw new Error("expected sightings");
    expect(result.watches.map((watch) => watch.model)).toEqual([
      "Planet Ocean",
      "Seamaster Diver 300M",
    ]);
    expect(result.watches[0]).toMatchObject({
      rationale: "Second first.",
      details: { person: "Daniel Craig", work: "Casino Royale", year: 2006 },
    });
  });
});

describe("collectUntilDeadline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("answers at the soft deadline once enough results arrived", async () => {
    const fast = Promise.resolve([1, 2, 3]);
    const slow = new Promise<number[]>(() => undefined);
    const pending = collectUntilDeadline([fast, slow], {
      softMs: 1_000,
      hardMs: 5_000,
      enough: (items) => items.length >= 3,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    expect(await pending).toEqual([1, 2, 3]);
  });

  it("waits past the soft deadline until the hard cap when results are short", async () => {
    const slow = new Promise<number[]>(() => undefined);
    let settled = false;
    const pending = collectUntilDeadline([Promise.resolve([1]), slow], {
      softMs: 1_000,
      hardMs: 5_000,
      enough: (items) => items.length >= 3,
    }).then((items) => {
      settled = true;
      return items;
    });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(3_000);
    expect(await pending).toEqual([1]);
  });
});

describe("runSafely", () => {
  it("turns a timeout into unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await runSafely(() => new Promise(() => undefined), 10)).toEqual({
      status: "unavailable",
    });
    vi.restoreAllMocks();
  });
});

describe("quiz cache input and constraints", () => {
  it("shares results across wrists in the same diameter band", () => {
    expect(quizCacheInput({ ...profile, wristCm: 17.1 })).toEqual(
      quizCacheInput({ ...profile, wristCm: 17.9, wearingScenarios: ["everyday", "office"] }),
    );
    expect(quizCacheInput({ ...profile, wristCm: 19 })).not.toEqual(quizCacheInput(profile));
  });

  it("describes the range and the wrist's diameter band", () => {
    const lines = quizConstraintLines(profile).join("\n");
    expect(lines).toContain("between EUR 3,000 and EUR 4,000");
    expect(lines).toContain("Case diameter 38-42 mm");
  });
});

// Steps 2 and 3 of the catalogue repair (owner, 2026-11-27: "Делай шаг 2 и
// шаг 3 на все часы и детально дополни существующий каталог ... даю добро
// на траты до 100 долларов начиная с нуля").
//
// For each watch an AI search added to the catalogue (source not a watch
// database):
// 1. Our server opens the stored source page. When it is a maker's or a
//    retailer's page whose text gives the reference, Muse Spark reads that
//    text (no web search) and copies the passage for each fact.
// 2. Otherwise Perplexity names candidate pages for the exact reference;
//    our server opens up to six (maker's sites first; never marketplaces,
//    grey dealers, forums, magazines or databases) and Muse reads the first
//    whose text gives the reference.
// 3. A value counts only when our own copy of the page gives the reference
//    in its text and the passage, and the passage gives the value (the rule
//    of step 1, scripts/fact-check-catalogue.ts). A rounded number never
//    corrects a more precise one, and a page naming the watch with only
//    some of the stored name's words changes nothing.
// 4. With --apply the facts go through watch_catalogue_fact_apply_v1
//    (migration 0124), which logs the value each replaces;
//    watch_catalogue_fact_revert_v1 undoes a run. A watch loses its
//    "reference confirmed" mark, and so shows only under "Also worth a
//    look", when its stored page is gone and no page that two Perplexity
//    queries named gives its reference. A watch whose reference turns out
//    to be another model gets that model's name and facts, and its price is
//    parked until it is checked again.
//
// Calibrated on the 60 pilot watches against Opus (2026-11-27). Muse's own
// web search was dropped: it gave 2 verified pages in 26 tries and called
// two real references missing.
//
//   node --env-file=.env --import tsx scripts/repair-catalogue.ts \
//     --run repair-1 --budget 40 [--apply] [--limit N] [--ids a,b] [--concurrency 6]
//
// Resumable: every checked watch is one line of .scratch/repair/<run>.jsonl
// (ignored by Git); a rerun with the same --run skips those watches and
// counts their spend. --apply-only writes the journal's facts without new
// calls. Only watch facts and public page text reach Muse and Perplexity;
// no visitor data.
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";
import { z } from "zod";

import { loadAiWatchFinderConfig } from "../app/domain/ai-providers.server";
import {
  classifySource,
  pageMentionsReference,
} from "../app/domain/ai-watch-guardrails";
import { pageSentences } from "../app/domain/cached-result-source-check.server";
import {
  publicFetch,
  safeHttpUrl,
  sourceHost,
  verifyImageUrl,
} from "../app/domain/source-pages.server";
import {
  catalogueWatchSchema,
  type CatalogueWatch,
} from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
  loadCatalogueRowsById,
  rpc,
} from "../app/domain/watch-catalogue.server";
import { databaseTls } from "./database-tls";
import {
  anotherSizeOrMovement,
  anotherWatch,
  checkField,
  FIELDS,
  makerName,
  modelCheck,
  pageKind,
  plain,
  specText,
  titleArea,
  type Field,
  type FieldResult,
} from "./repair-rules";

// ---------------------------------------------------------------------------
// Options

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const run = option("run");
const budgetUsd = Number(option("budget") ?? 0);
const limit = Number(option("limit") ?? Number.POSITIVE_INFINITY);
const concurrency = Number(option("concurrency") ?? 6);
// --ids a,b or --ids-file list.json (a JSON list of catalogue ids).
const idsFile = option("ids-file");
const ids = idsFile
  ? (JSON.parse(readFileSync(idsFile, "utf8")) as string[])
  : option("ids")?.split(",");
const apply = process.argv.includes("--apply");
const applyOnly = process.argv.includes("--apply-only");
// --pages-from <run>: read again the page an earlier run found for each
// watch, with today's rules, and nothing else (no search, no mark dropped).
const pagesFrom = option("pages-from");
// --pause-ms: a pause after each write of --apply-only, so the live searches
// stay quick while it writes (2026-11-27).
const pauseMs = Number(option("pause-ms") ?? 0);
if (!run || !/^[a-z0-9-]{1,60}$/.test(run))
  throw new Error("--run takes lowercase letters, digits and dashes.");
if (pagesFrom !== undefined && !/^[a-z0-9-]{1,60}$/.test(pagesFrom))
  throw new Error("--pages-from takes an earlier run's name.");
if (!Number.isInteger(pauseMs) || pauseMs < 0 || pauseMs > 10_000)
  throw new Error("--pause-ms takes 0-10000.");
if (
  !applyOnly &&
  (!Number.isFinite(budgetUsd) || budgetUsd <= 0 || budgetUsd > 60)
)
  throw new Error("--budget <usd> is required: above 0 and at most 60.");
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 20)
  throw new Error("--concurrency takes 1-20.");
const muse = loadAiWatchFinderConfig().museSpark;
if (!muse && !applyOnly) throw new Error("MUSE_SPARK_API_KEY is required.");
const client = catalogueClient();
if (!client) throw new Error("SUPABASE_URL and the service key are required.");

// ---------------------------------------------------------------------------
// Pages: which may give facts, and our own copy of them

const PAGE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
  accept: "text/html,application/xhtml+xml",
};
type Page =
  | {
      state: "opened";
      url: string;
      text: string;
      imageUrl: string | null;
    }
  | { state: "blocked" | "missing" | "failed"; url: string; status?: number };

const activeByHost = new Map<string, number>();
async function politely<T>(url: string, work: () => Promise<T>) {
  const host = sourceHost(url) ?? "";
  while ((activeByHost.get(host) ?? 0) >= 2)
    await new Promise((done) => setTimeout(done, 200));
  activeByHost.set(host, (activeByHost.get(host) ?? 0) + 1);
  try {
    return await work();
  } finally {
    activeByHost.set(host, (activeByHost.get(host) ?? 1) - 1);
  }
}

async function openPage(url: string): Promise<Page> {
  return politely(url, async () => {
    try {
      const fetched = await publicFetch(
        url,
        { headers: PAGE_HEADERS, signal: AbortSignal.timeout(15_000) },
        fetch,
      );
      if (!fetched) return { state: "failed", url };
      const { response, finalUrl } = fetched;
      if (!response.ok) {
        await response.body?.cancel();
        return {
          state: [401, 403, 429].includes(response.status)
            ? "blocked"
            : "missing",
          url: finalUrl,
          status: response.status,
        };
      }
      const html = (await response.text()).slice(0, 2_000_000);
      const meta =
        /<meta[^>]+(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i.exec(
          html,
        ) ??
        /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']og:image["']/i.exec(
          html,
        );
      let imageUrl: string | null = null;
      try {
        imageUrl = meta?.[1]
          ? safeHttpUrl(
              new URL(meta[1].replace(/&amp;/g, "&"), finalUrl).toString(),
            )
          : null;
      } catch {
        imageUrl = null;
      }
      return {
        state: "opened",
        url: finalUrl,
        text: pageSentences(html).join(" \n "),
        imageUrl,
      };
    } catch {
      return { state: "failed", url };
    }
  });
}

// ---------------------------------------------------------------------------
// Muse Spark: read a page we opened, or find the maker's page

const fieldAnswer = z
  .object({
    value: z.union([z.string(), z.number(), z.boolean()]).nullable(),
    passage: z.string().max(500).nullable(),
  })
  .nullable()
  .catch(null);
const answerSchema = z.object({
  pageUrl: z.string().nullable().catch(null),
  referenceExists: z.boolean().nullable().catch(null),
  showsWatch: z.boolean().nullable().catch(null),
  model: fieldAnswer,
  caseDiameterMm: fieldAnswer,
  caseThicknessMm: fieldAnswer,
  movement: fieldAnswer,
  inHouseCalibre: fieldAnswer,
  waterResistanceM: fieldAnswer,
  caseMaterial: fieldAnswer,
  casebackMaterial: fieldAnswer,
  strapMaterial: fieldAnswer,
  crystal: fieldAnswer,
});
type Answer = z.infer<typeof answerSchema>;

const FIELD_RULES = [
  "For each fact give the value and copy, word for word, the shortest passage of the page that states it: one line of the specification list or one sentence. Give null for a fact the page does not state; never guess or use other knowledge.",
  "model: the watch's name as the page gives it, without the brand; take it from the product's title or main heading when the page has one. caseDiameterMm and caseThicknessMm: numbers in millimetres (a case length or lug width is not a diameter). movement: automatic, manual, quartz, solar, spring_drive or hybrid (hybrid for kinetic). inHouseCalibre: true when the page says the movement is the maker's own (in-house, manufacture), false when it names another maker's base calibre (ETA, Sellita, Miyota, Seiko NH, Ronda and so on), else null. waterResistanceM: metres (10 bar or 10 ATM is 100). caseMaterial, casebackMaterial, strapMaterial, crystal: short plain words such as stainless steel, titanium, rubber, leather, sapphire.",
].join("\n");

const READ_INSTRUCTIONS = [
  "You read one product page of a watch shop or watch maker, given as text, and copy the facts of one watch from it.",
  "showsWatch: true only if this page is the product page of the watch with the given reference.",
  "When lookFor lists facts, search the whole page text for those facts in particular; their lines may be far apart.",
  FIELD_RULES,
  'Reply with JSON only: {"showsWatch": true or false, "model": {"value", "passage"} or null, "caseDiameterMm": {...}, "caseThicknessMm": {...}, "movement": {...}, "inHouseCalibre": {...}, "waterResistanceM": {...}, "caseMaterial": {...}, "casebackMaterial": {...}, "strapMaterial": {...}, "crystal": {...}}.',
].join("\n\n");

const contributor = () => muse!.fastModel.endsWith("-contributor");
let spent = 0;
let stopReason: string | null = null;
const READ_CEILING_USD = 0.01;
/** The most one watch can cost: two Perplexity queries and two reads. */
const CALL_CEILING_USD = 0.03;
const PERPLEXITY_CEILING_USD = 0.02;
const perplexityKey = process.env.PERPLEXITY_API_KEY?.trim();

function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return answerSchema.parse(JSON.parse(text.slice(start, end + 1)));
}

async function museRead(
  watch: CatalogueWatch,
  page: string,
  meter: { usd: number },
  lookFor: Field[] = [],
) {
  const response = await fetch(new URL("chat/completions", muse!.baseUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${muse!.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: muse!.fastModel,
      reasoning_effort: "minimal",
      temperature: 0,
      prompt_cache_key: "reserve-catalogue-repair-read-v1",
      max_tokens: 6_000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: READ_INSTRUCTIONS },
        {
          role: "user",
          content: JSON.stringify({
            brand: watch.brand,
            model: watch.model,
            reference: watch.referenceCode,
            ...(lookFor.length ? { lookFor } : {}),
            pageText: page,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(90_000),
  });
  const body = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: unknown } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  } | null;
  const usage = body?.usage;
  const cost = usage
    ? ((usage.prompt_tokens ?? 0) * (contributor() ? 0.1 : 1.25) +
        (usage.completion_tokens ?? 0) * (contributor() ? 0.2 : 4.25)) /
      1_000_000
    : READ_CEILING_USD;
  spent += cost;
  meter.usd += cost;
  if (!response.ok) throw new Error(`Muse read returned ${response.status}`);
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("Muse read: no content");
  return { answer: parseJson(content), cost };
}

/** One more try when an answer is cut off or unreadable, budget allowing. */
async function twice<T>(work: () => Promise<T>) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      // Muse answers 429 when two runs share its quota: wait and try again.
      const busy = /returned 429/.test((error as Error).message);
      if (attempt >= (busy ? 4 : 2) || spent + CALL_CEILING_USD > budgetUsd)
        throw error;
      if (busy) await new Promise((done) => setTimeout(done, 4_000 * attempt));
    }
  }
}

/**
 * Perplexity names pages for the exact reference; only their addresses are
 * used, maker's sites first, then shops. Our server opens them itself.
 */
async function perplexityFind(
  watch: CatalogueWatch,
  query: "full" | "short",
  meter: { usd: number },
) {
  if (!perplexityKey) return [];
  const question =
    query === "full"
      ? `Find the product page of the ${watch.brand} ${watch.model} watch, reference ${watch.referenceCode}, on ${watch.brand}'s own website, and the product pages of authorised retailers that list this exact reference. Reply with the page addresses only.`
      : `${watch.brand} ${watch.referenceCode} watch product page`;
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${perplexityKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "sonar",
      max_tokens: 300,
      temperature: 0,
      web_search_options: { search_context_size: "low" },
      messages: [
        {
          role: "user",
          content: question,
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  const body = (await response.json().catch(() => null)) as {
    search_results?: { url?: unknown }[];
    citations?: unknown[];
    usage?: { cost?: { total_cost?: unknown } };
  } | null;
  // Perplexity reports each call's cost (about $0.005) without a currency
  // field, so the app's stricter reader would not count it.
  const reported = Number(body?.usage?.cost?.total_cost);
  const cost =
    Number.isFinite(reported) && reported >= 0
      ? reported
      : PERPLEXITY_CEILING_USD;
  spent += cost;
  meter.usd += cost;
  if (!response.ok) return [];
  const urls = new Set<string>();
  for (const value of [
    ...(body?.search_results ?? []).map((result) => result.url),
    ...(body?.citations ?? []),
  ]) {
    const url = typeof value === "string" ? safeHttpUrl(value) : null;
    if (url && pageKind(url, watch.brand)) urls.add(url);
  }
  return [...urls].sort(
    (a, b) =>
      Number(pageKind(b, watch.brand) === "maker") -
      Number(pageKind(a, watch.brand) === "maker"),
  );
}

// ---------------------------------------------------------------------------
// Checking an answer against our own copy of the page

// ---------------------------------------------------------------------------
// One watch

type Result = {
  id: string;
  brand: string;
  reference: string | null;
  tier: "stored" | "found" | "none";
  candidates?: number;
  storedPage: Page["state"] | "none";
  page: Page["state"] | "none";
  pageUrl: string | null;
  pageKind: "maker" | "retailer" | null;
  referenceOnPage: boolean;
  fields: Partial<Record<Field, FieldResult>>;
  dropReference: boolean;
  identityChanged: boolean;
  imageUrl: string | null;
  newSourceUrl: string | null;
  costUsd: number;
  error?: string;
  applied?: number | null;
};

async function check(watch: CatalogueWatch): Promise<Result> {
  const base: Result = {
    id: watch.id,
    brand: watch.brand,
    reference: watch.referenceCode,
    tier: "none",
    storedPage: "none",
    page: "none",
    pageUrl: null,
    pageKind: null,
    referenceOnPage: false,
    fields: {},
    dropReference: false,
    identityChanged: false,
    imageUrl: null,
    newSourceUrl: null,
    costUsd: 0,
  };
  // Each watch's own spend, so the journal stays right when several watches
  // are checked at once.
  const meter = { usd: 0 };
  let answer: Answer | null = null;
  let page: Extract<Page, { state: "opened" }> | null = null;
  let kind: "maker" | "retailer" | null = null;
  /** Facts the answer gives with a passage. */
  const given = (value: Answer) =>
    FIELDS.filter(
      (field) => value[field]?.passage && value[field]?.value != null,
    ).length;

  // 0. With --pages-from: the page that run found, and nothing else.
  const known = earlierPages?.get(watch.id);
  if (known) {
    const opened = await openPage(known);
    base.storedPage = opened.state;
    const openedKind =
      opened.state === "opened" ? pageKind(opened.url, watch.brand) : null;
    if (
      opened.state === "opened" &&
      openedKind &&
      pageMentionsReference(watch.referenceCode, opened.text, "")
    ) {
      const read = await twice(() =>
        museRead(watch, specText(opened.text, watch.referenceCode), meter),
      );
      if (read.answer.showsWatch !== false) {
        answer = read.answer;
        page = opened;
        kind = openedKind;
        base.tier = "stored";
      }
    }
  }
  // 1. The stored page, read without a search. A read that gives fewer than
  // two facts is kept only if no other page gives more.
  const stored =
    !known && watch.sourceUrl ? await openPage(watch.sourceUrl) : null;
  if (!known) base.storedPage = stored?.state ?? "none";
  const storedKind = stored ? pageKind(stored.url, watch.brand) : null;
  let fallback: {
    answer: Answer;
    page: Extract<Page, { state: "opened" }>;
  } | null = null;
  if (
    stored?.state === "opened" &&
    storedKind &&
    pageMentionsReference(watch.referenceCode, stored.text, "")
  ) {
    const read = await twice(() =>
      museRead(watch, specText(stored.text, watch.referenceCode), meter),
    );
    if (read.answer.showsWatch !== false) {
      if (given(read.answer) >= 2) {
        answer = read.answer;
        page = stored;
        kind = storedKind;
        base.tier = "stored";
      } else {
        fallback = { answer: read.answer, page: stored };
      }
    }
  }
  // 2. Otherwise Perplexity names candidate pages, first with the watch's
  // full name, then with brand and reference alone; our server opens up to
  // eight of each, maker's pages first, and Muse reads the first that
  // gives the reference.
  let blockedCandidate = false;
  let shownByCandidate = false;
  for (const query of answer || known || !watch.referenceCode
    ? []
    : (["full", "short"] as const)) {
    const candidates = await perplexityFind(watch, query, meter);
    base.candidates = (base.candidates ?? 0) + candidates.length;
    for (const url of candidates.slice(0, 8)) {
      if (stored && url === stored.url) continue;
      const opened = await openPage(url);
      // A blocked page holds the mark only if its address carries the
      // reference: then it may be the product page we cannot read.
      if (
        opened.state === "blocked" &&
        pageMentionsReference(watch.referenceCode, "", url)
      )
        blockedCandidate = true;
      if (
        opened.state !== "opened" ||
        !pageMentionsReference(watch.referenceCode, opened.text, "")
      )
        continue;
      shownByCandidate = true;
      const read = await twice(() =>
        museRead(watch, specText(opened.text, watch.referenceCode), meter),
      );
      if (read.answer.showsWatch !== false && given(read.answer) > 0) {
        answer = read.answer;
        page = opened;
        kind = pageKind(opened.url, watch.brand);
        base.tier = "found";
        break;
      }
    }
    if (answer) break;
  }
  if (!answer && fallback) {
    answer = fallback.answer;
    page = fallback.page;
    kind = storedKind;
    base.tier = "stored";
  }
  if (answer) base.page = "opened";
  // The facts the quiz rules need most: when a read missed one, one more
  // read of the same page looks for those alone.
  const missing = (
    ["caseDiameterMm", "waterResistanceM", "movement"] as const
  ).filter(
    (field) => !answer?.[field]?.passage || answer[field]?.value == null,
  );
  if (answer && page && missing.length) {
    const again = await twice(() =>
      museRead(watch, specText(page.text, watch.referenceCode), meter, [
        ...missing,
      ]),
    ).catch(() => null);
    for (const field of missing)
      if (again?.answer[field]?.passage && again.answer[field]?.value != null)
        answer[field] = again.answer[field];
  }
  base.pageUrl = page?.url ?? null;
  base.pageKind = kind;
  base.referenceOnPage = Boolean(
    page && pageMentionsReference(watch.referenceCode, page.text, ""),
  );
  if (page && answer && base.referenceOnPage && kind) {
    const text = plain(page.text);
    for (const field of FIELDS)
      base.fields[field] = checkField(watch, field, answer[field], text);
    // The maker's own product page for the exact reference: the reference
    // is in its title area or its address. There the maker's name for the
    // watch wins over a stored name that contradicts it (makerName), and a
    // partly matching name blocks nothing.
    const lines = page.text.split(" \n ");
    const productPage =
      kind === "maker" &&
      (pageMentionsReference(
        watch.referenceCode,
        lines.slice(0, 25).join(" \n "),
        "",
      ) ||
        pageMentionsReference(watch.referenceCode, "", page.url));
    if (productPage) {
      const diameter = base.fields.caseDiameterMm;
      const renamed = makerName(watch, answer.model, titleArea(page.text), {
        diameterMm:
          diameter && diameter.status !== "unconfirmed"
            ? Number(diameter.value)
            : null,
        text,
        hardFactDiffers: anotherSizeOrMovement(base.fields),
      });
      if (renamed) base.fields.model = renamed;
    }
    // Elsewhere, a page that names the watch with only some of the stored
    // name's words may show a sibling model: nothing is changed from it.
    if (base.fields.model?.ambiguous && !productPage)
      for (const field of FIELDS) {
        const item = base.fields[field];
        if (item && item.status !== "confirmed")
          base.fields[field] = { status: "unconfirmed", stored: item.stored };
      }
    base.identityChanged =
      base.fields.model?.status === "corrected" &&
      (base.fields.model.makerTitle
        ? anotherSizeOrMovement(base.fields)
        : anotherWatch(base.fields));
    if (!watch.imageUrl && kind === "maker" && page.imageUrl)
      base.imageUrl = await verifyImageUrl(page.imageUrl, fetch);
    const storedBroken =
      !watch.sourceUrl ||
      base.storedPage === "missing" ||
      !storedKind ||
      (storedKind !== "maker" && kind === "maker");
    if (kind === "maker" && storedBroken && page.url.startsWith("https://"))
      base.newSourceUrl = page.url;
  }
  // 3. No page gives the reference: the stored page is gone (or there is
  // none), and no page that two Perplexity queries named gives it, with
  // none of them blocked to our server. A stored page that still opens is
  // never enough to drop the mark (its text may load later in a browser).
  base.dropReference =
    !known &&
    watch.referenceConfirmed &&
    !base.referenceOnPage &&
    !shownByCandidate &&
    !blockedCandidate &&
    (base.storedPage === "missing" || base.storedPage === "none");
  base.costUsd = Number(meter.usd.toFixed(5));
  return base;
}

// ---------------------------------------------------------------------------
// Writing a result

function factsOf(watch: CatalogueWatch, rawResult: Result) {
  const result: Result = { ...rawResult, fields: { ...rawResult.fields } };
  if (result.pageUrl && !pageKind(result.pageUrl, watch.brand)) {
    result.fields = {};
    result.imageUrl = null;
    result.newSourceUrl = null;
    result.identityChanged = false;
  }
  // A "correction" to the very same name is a confirmation (a journal
  // written before makerName skipped them).
  if (
    result.fields.model?.status === "corrected" &&
    result.fields.model.value === result.fields.model.stored
  )
    result.fields.model = { ...result.fields.model, status: "confirmed" };
  const model = result.fields.model;
  if (model?.status === "corrected" && typeof model.value === "string") {
    // The maker's name from its own product page (makerName) stands on its
    // own; the watch counts as another model, and its price is parked, only
    // when the page gives another case size or movement too.
    if (model.makerTitle) {
      result.identityChanged = anotherSizeOrMovement(result.fields);
    } else {
      const again = modelCheck(watch, model.value, model.passage ?? "");
      if (again.status !== "corrected" || !anotherWatch(result.fields)) {
        result.fields.model = { status: "unconfirmed", stored: model.stored };
        result.identityChanged = false;
      } else {
        result.identityChanged = true;
      }
    }
  }
  const method = result.pageKind === "maker" ? "maker_page" : "retailer_page";
  const facts: Record<string, unknown>[] = [];
  for (const [field, item] of Object.entries(result.fields)) {
    if (!item || item.status === "unconfirmed") continue;
    facts.push({
      field,
      status: item.status,
      value: item.value,
      method,
      sourceUrl: result.pageUrl,
      passage: item.passage,
      model: muse?.fastModel ?? null,
    });
  }
  if (result.imageUrl?.startsWith("https://"))
    facts.push({
      field: "imageUrl",
      status: "filled",
      value: result.imageUrl,
      method,
      sourceUrl: result.pageUrl,
    });
  // Database-imported records keep their database as their source and
  // their mark; AI-found ones take the maker's page as their source, and
  // the site's own rule (classifySource: the maker's site or a listed
  // authorised retailer) decides what the card then says about it.
  const imported = watch.sourceKind === "catalogue";
  const newSourceKind = result.newSourceUrl
    ? classifySource(result.newSourceUrl, watch.brand)
    : null;
  // The same page again is no new source (run reread-1 rewrote 605 such
  // addresses before this check, 2026-11-27).
  if (
    !imported &&
    result.newSourceUrl &&
    newSourceKind &&
    result.newSourceUrl !== watch.sourceUrl
  ) {
    facts.push({
      field: "sourceUrl",
      status: watch.sourceUrl ? "corrected" : "filled",
      value: result.newSourceUrl,
      method,
      sourceUrl: result.newSourceUrl,
    });
    facts.push({
      field: "sourceKind",
      status: watch.sourceKind === newSourceKind ? "confirmed" : "corrected",
      value: newSourceKind,
      method,
      sourceUrl: result.newSourceUrl,
    });
  }
  // A page of the maker or of a listed authorised retailer whose own text
  // gives the reference confirms it, as the catalogue rule says.
  if (
    !imported &&
    !watch.referenceConfirmed &&
    result.referenceOnPage &&
    result.pageUrl &&
    classifySource(result.pageUrl, watch.brand)
  )
    facts.push({
      field: "referenceConfirmed",
      status: "corrected",
      value: true,
      method,
      sourceUrl: result.pageUrl,
      passage: `The page's own text gives the reference ${watch.referenceCode}.`,
    });
  // An imported record's price belongs to its reference, so it stays.
  if (
    !imported &&
    result.identityChanged &&
    watch.priceStatus !== "unconfirmed"
  )
    facts.push({
      field: "priceStatus",
      status: "corrected",
      value: "unconfirmed",
      method: "derived",
      sourceUrl: result.pageUrl,
      passage:
        "The reference belongs to another model; its price is checked again before it is shown.",
    });
  if (!imported && result.dropReference)
    facts.push({
      field: "referenceConfirmed",
      status: "corrected",
      value: false,
      method: "derived",
      passage: `No maker or retailer page gives this reference (stored page: ${result.storedPage}; two searches found no page giving it).`,
    });
  return facts;
}

async function write(watch: CatalogueWatch, result: Result) {
  const facts = factsOf(watch, result);
  if (!facts.length) return 0;
  return z
    .number()
    .parse(
      await rpc(
        client!,
        "watch_catalogue_fact_apply_v1",
        { p_watch_id: watch.id, p_run: run, p_facts: facts },
        20_000,
      ),
    );
}

// ---------------------------------------------------------------------------
// The run

const journalPath = resolve(`.scratch/repair/${run}.jsonl`);
mkdirSync(resolve(".scratch/repair"), { recursive: true });
const journal = new Map<string, Result>();
if (existsSync(journalPath))
  for (const line of readFileSync(journalPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    // A run stopped mid-write leaves at most its last line unfinished; that
    // watch is simply checked again.
    try {
      const entry = JSON.parse(line) as Result;
      journal.set(entry.id, entry);
    } catch {
      continue;
    }
  }
spent = [...journal.values()].reduce((sum, entry) => sum + entry.costUsd, 0);

// --pages-from: each watch's page in the earlier run's journal, when that
// run found the maker's or a shop's page giving the reference.
const earlierPages = pagesFrom ? new Map<string, string>() : null;
if (pagesFrom && earlierPages) {
  const path = resolve(`.scratch/repair/${pagesFrom}.jsonl`);
  if (!existsSync(path)) throw new Error(`No journal for run ${pagesFrom}.`);
  const latest = new Map<string, Result>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as Result;
      latest.set(entry.id, entry);
    } catch {
      continue;
    }
  }
  for (const entry of latest.values())
    if (entry.pageUrl && entry.pageKind && entry.referenceOnPage)
      earlierPages.set(entry.id, entry.pageUrl);
}

// Writing needs only the journal's watches, read by id; checking reads the
// whole catalogue, with up to three tries (a busy database can take longer
// than the listing's 45 seconds).
async function wholeCatalogue() {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await listCatalogue(client!);
    } catch (error) {
      if (attempt >= 3) throw error;
      await new Promise((done) => setTimeout(done, 10_000));
    }
  }
}
// The review queue holds records the listing and the by-id read leave out
// (no price, or above the tools' range), so --set pending reads its rows
// straight from the table, through the same JSON every catalogue read uses
// (private.watch_catalogue_json).
async function databaseRows(which: "pending" | string[]) {
  const databaseUrl = process.env.DIRECT_DATABASE_URL?.trim();
  if (!databaseUrl)
    throw new Error("DIRECT_DATABASE_URL is required for --set pending.");
  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: databaseTls(),
    connect_timeout: 15,
    onnotice: () => undefined,
  });
  try {
    const rows =
      which === "pending"
        ? await sql<{ row: unknown }[]>`
            select private.watch_catalogue_json(w) as row
            from private.watch_catalogue w where w.review_status = 'pending'`
        : await sql<{ row: unknown }[]>`
            select private.watch_catalogue_json(w) as row
            from private.watch_catalogue w where w.id = any(${which}::uuid[])`;
    return z.array(catalogueWatchSchema).parse(rows.map((entry) => entry.row));
  } finally {
    await sql.end();
  }
}
const pendingSet = option("set") === "pending";
const catalogue = applyOnly
  ? pendingSet
    ? await databaseRows([...journal.keys()])
    : await loadCatalogueRowsById(client, [...journal.keys()])
  : pendingSet
    ? await databaseRows("pending")
    : await wholeCatalogue();
const byId = new Map(catalogue.map((watch) => [watch.id, watch]));
// --set ai (default): watches an AI search added. --set database: watches
// imported from watch databases, priced within the catalogue's range, that
// still lack water resistance, a photo or a thickness. --set pending: every
// watch waiting for review on /admin/catalogue, checked before it is
// approved (owner, 2026-11-27: "approve all pending watches ... проверяя его
// судьей-perplexity-muse").
const set = option("set") ?? "ai";
if (set !== "ai" && set !== "database" && set !== "pending")
  throw new Error("--set takes ai, database or pending.");
const selected = catalogue
  .filter((watch) =>
    set === "pending"
      ? watch.reviewStatus === "pending"
      : set === "ai"
        ? watch.sourceKind !== "catalogue"
        : watch.sourceKind === "catalogue" &&
          watch.priceAmount !== null &&
          watch.priceAmount <= 10_000 &&
          (watch.waterResistanceM === null ||
            watch.imageUrl === null ||
            watch.caseThicknessMm === null),
  )
  .filter((watch) => watch.reviewStatus !== "rejected")
  .filter((watch) => !earlierPages || earlierPages.has(watch.id))
  .filter((watch) => !ids || ids.includes(watch.id))
  .sort((a, b) => a.id.localeCompare(b.id));

if (applyOnly) {
  // Watches this run already wrote, read from the database's own log, so a
  // stopped or failed write run never writes a watch twice.
  const done = new Set<string>();
  const databaseUrl = process.env.DIRECT_DATABASE_URL?.trim();
  if (!databaseUrl)
    throw new Error("DIRECT_DATABASE_URL is required to resume writing.");
  const sql = postgres(databaseUrl, {
    max: 1,
    ssl: databaseTls(),
    connect_timeout: 15,
    onnotice: () => undefined,
  });
  try {
    for (const row of await sql<{ watch_id: string }[]>`
      select distinct watch_id from private.watch_catalogue_fact_log where run = ${run}`)
      done.add(row.watch_id);
  } finally {
    await sql.end();
  }
  let written = 0;
  let failed = 0;
  for (const entry of journal.values()) {
    const watch = byId.get(entry.id);
    if (!watch || typeof entry.applied === "number" || done.has(entry.id))
      continue;
    try {
      entry.applied = await write(watch, entry);
      written += entry.applied;
    } catch (error) {
      entry.applied = null;
      entry.error = `apply: ${(error as Error).message.slice(0, 180)}`;
      failed += 1;
    }
    appendFileSync(journalPath, `${JSON.stringify(entry)}\n`);
    if (pauseMs) await new Promise((done) => setTimeout(done, pauseMs));
  }
  console.log(
    `Applied the journal: ${written} columns changed; ${done.size} watches were already written; ${failed} writes failed.`,
  );
  process.exit(0);
}

// A watch whose check failed (an error, nothing written) is checked again.
const todo = selected
  .filter((watch) => {
    const entry = journal.get(watch.id);
    return !entry || (entry.error !== undefined && !entry.applied);
  })
  .slice(0, limit);
console.log(
  `${selected.length} AI-found watches; ${journal.size} already in ${run}; checking ${todo.length}; spent so far $${spent.toFixed(4)} of $${budgetUsd}.`,
);
let next = 0;
let done = 0;
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    while (next < todo.length) {
      const watch = todo[next++]!;
      if (stopReason || spent + concurrency * CALL_CEILING_USD > budgetUsd) {
        stopReason ??= `the next calls could pass $${budgetUsd} (spent $${spent.toFixed(4)})`;
        continue;
      }
      let result: Result;
      try {
        result = await check(watch);
      } catch (error) {
        result = {
          id: watch.id,
          brand: watch.brand,
          reference: watch.referenceCode,
          tier: "none",
          storedPage: "none",
          page: "none",
          pageUrl: null,
          pageKind: null,
          referenceOnPage: false,
          fields: {},
          dropReference: false,
          identityChanged: false,
          imageUrl: null,
          newSourceUrl: null,
          costUsd: 0,
          error: (error as Error).message.slice(0, 200),
        };
      }
      if (apply && !result.error) {
        try {
          result.applied = await write(watch, result);
        } catch (error) {
          result.applied = null;
          result.error = `apply: ${(error as Error).message.slice(0, 180)}`;
        }
      }
      journal.set(watch.id, result);
      appendFileSync(journalPath, `${JSON.stringify(result)}\n`);
      done += 1;
      if (done % 50 === 0)
        console.log(
          `${done} of ${todo.length} checked, $${spent.toFixed(4)} spent`,
        );
    }
  }),
);

// ---------------------------------------------------------------------------
// Report

const results = [...journal.values()].filter((entry) => byId.has(entry.id));
const count = (test: (entry: Result) => boolean) => results.filter(test).length;
const fieldTally = Object.fromEntries(
  FIELDS.map((field) => {
    const tally: Record<string, number> = {};
    for (const entry of results) {
      const status = entry.fields[field]?.status;
      if (status) tally[status] = (tally[status] ?? 0) + 1;
    }
    return [field, tally];
  }),
);
const corrections = results
  .flatMap((entry) =>
    Object.entries(entry.fields)
      .filter(([, item]) => item?.status === "corrected")
      .map(([field, item]) => ({
        brand: entry.brand,
        reference: entry.reference,
        field,
        from: item.stored,
        to: item.value,
        host: sourceHost(entry.pageUrl),
        passage: item.passage,
      })),
  )
  .slice(0, 60);
const report = {
  at: new Date().toISOString(),
  run,
  model: muse?.fastModel ?? null,
  applied: apply,
  budgetUsd,
  spendUsd: Number(spent.toFixed(4)),
  stopReason,
  watches: results.length,
  errors: count((entry) => Boolean(entry.error)),
  tiers: {
    storedPage: count((entry) => entry.tier === "stored"),
    perplexityPage: count((entry) => entry.tier === "found"),
  },
  pages: {
    referenceOnPage: count((entry) => entry.referenceOnPage),
    maker: count(
      (entry) => entry.referenceOnPage && entry.pageKind === "maker",
    ),
    retailer: count(
      (entry) => entry.referenceOnPage && entry.pageKind === "retailer",
    ),
  },
  fields: fieldTally,
  watchesWithACorrection: count((entry) =>
    Object.values(entry.fields).some((item) => item?.status === "corrected"),
  ),
  referenceMarkDropped: count((entry) => entry.dropReference),
  identityChanged: count((entry) => entry.identityChanged),
  imagesAdded: count((entry) => Boolean(entry.imageUrl)),
  sourcePagesReplaced: count((entry) => Boolean(entry.newSourceUrl)),
  columnsChanged: results.reduce((sum, entry) => sum + (entry.applied ?? 0), 0),
  correctionSample: corrections,
  rows: results.map((entry) => ({
    id: entry.id,
    tier: entry.tier,
    page: entry.page,
    host: sourceHost(entry.pageUrl),
    ref: entry.referenceOnPage,
    fields: Object.fromEntries(
      Object.entries(entry.fields).map(([field, item]) => [
        field,
        item?.status,
      ]),
    ),
    drop: entry.dropReference || undefined,
    identity: entry.identityChanged || undefined,
    error: entry.error,
  })),
};
const output = resolve(`docs/reports/${run}-${report.at.slice(0, 10)}.json`);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(
  JSON.stringify(
    { ...report, rows: undefined, correctionSample: corrections.slice(0, 12) },
    null,
    2,
  ),
);
console.log(`Wrote ${output}`);
process.exit(0);

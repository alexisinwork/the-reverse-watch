// Finds a product photo for catalogue watches that have none. The owner's
// method (2026-11-28): search "[NAME] + [REF]", take the maker's page if
// there is one, otherwise a shop or a grey-market dealer, copy the photo's
// address and save it as the watch's image.
//
// For each watch the search names pages for the brand, model and reference;
// our server opens them itself (the maker's site first, then shops, then
// grey-market dealers) and keeps a page only when its own text shows the
// exact reference. The page's product photo is kept when its address serves
// a picture that is not a banner, a logo or the site's share card (rules:
// scripts/photo-rules.ts). Only the address is stored, never the file
// (AGENTS.md), through the fact log, so a run is undone with
// watch_catalogue_fact_revert_v1(run). A price shown on the page is
// reported, never stored: prices keep their own two-source check.
//
//   node --env-file=.env --import tsx scripts/find-catalogue-photos.ts --sample 10 --run photos-test-1
//   node --env-file=.env --import tsx scripts/find-catalogue-photos.ts --sample 10 --run photos-test-1 --write
//
// To store exactly what a dry run found and someone looked at, without
// searching again (a search can name other pages the next time):
//   node --env-file=.env --import tsx scripts/find-catalogue-photos.ts --run photos-test-1 --apply [--skip <id>,<id>]
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import postgres from "postgres";

import { pageMentionsReference } from "../app/domain/ai-watch-guardrails";
import {
  publicFetch,
  safeHttpUrl,
  sourceHost,
  verifyImageUrl,
} from "../app/domain/source-pages.server";
import { databaseTls } from "./database-tls";
import {
  alnum,
  asHttps,
  BLOCKS_US,
  imageSize,
  namesAnotherVariant,
  NOT_A_PRODUCT_PHOTO,
  pagePrice,
  photoAddresses,
  type PhotoSource,
  photoSourceKind,
  productPhotoShape,
  SOURCE_ORDER,
} from "./photo-rules";

const args = process.argv.slice(2);
const option = (name: string) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const sample = Number(option("--sample") ?? 10);
const run = option("--run") ?? "";
const write = args.includes("--write");
const budgetUsd = Number(option("--budget") ?? 0.5);
if (!/^[a-z0-9-]{1,60}$/.test(run)) {
  console.error("Pass --run <name> (lowercase letters, digits, dashes).");
  process.exit(2);
}
if (
  !args.includes("--all") &&
  (!Number.isInteger(sample) || sample < 1 || sample > 50)
) {
  console.error("--sample must be between 1 and 50 for a test run.");
  process.exit(2);
}
const perplexityKey = process.env.PERPLEXITY_API_KEY?.trim();

type Watch = {
  id: string;
  brand: string;
  model: string;
  reference: string;
  sourceUrl: string | null;
  imported: boolean;
};
type Size = { width: number; height: number } | null;
type Chosen = {
  pageUrl: string;
  kind: PhotoSource;
  imageUrl: string;
  size?: Size;
};

let spent = 0;
let stopReason: string | null = null;

async function searchPages(watch: Watch, query: "full" | "short") {
  if (!perplexityKey) throw new Error("PERPLEXITY_API_KEY is not set.");
  // The short query is the owner's own: "[NAME] + [REF]".
  const question =
    query === "full"
      ? `Find web pages that show the ${watch.brand} ${watch.model} watch, reference ${watch.reference}: first the product page on ${watch.brand}'s own website, then shops that sell this exact reference (authorised retailers or grey-market dealers). Reply with the page addresses only.`
      : `${watch.brand} ${watch.reference}`;
  let response: Response | null = null;
  for (let attempt = 1; attempt <= 3 && !stopReason; attempt += 1) {
    try {
      response = await fetch("https://api.perplexity.ai/chat/completions", {
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
          messages: [{ role: "user", content: question }],
        }),
        signal: AbortSignal.timeout(45_000),
      });
    } catch {
      response = null;
    }
    // A refused key or an empty balance ends the run: the site's own
    // searches use the same account (owner: "остановись только если деньги
    // закончатся").
    if (response && [401, 402, 403].includes(response.status)) {
      stopReason = `perplexity answered ${response.status}`;
      return { urls: [] as string[], cost: 0 };
    }
    if (response && response.status !== 429 && response.status < 500) break;
    await new Promise((done) => setTimeout(done, 5_000 * attempt * attempt));
  }
  if (!response) return { urls: [] as string[], cost: 0 };
  const body = (await response.json().catch(() => null)) as {
    search_results?: { url?: unknown }[];
    citations?: unknown[];
    usage?: { cost?: { total_cost?: unknown } };
  } | null;
  // Perplexity reports each call's cost (about $0.005); an answered call
  // that does not is counted at twice that.
  const reported = Number(body?.usage?.cost?.total_cost);
  const cost = !response.ok
    ? 0
    : Number.isFinite(reported) && reported >= 0
      ? reported
      : 0.01;
  spent += cost;
  if (!response.ok) return { urls: [] as string[], cost };
  const urls: string[] = [];
  for (const value of [
    ...(body?.search_results ?? []).map((result) => result.url),
    ...(body?.citations ?? []),
  ]) {
    const url = typeof value === "string" ? safeHttpUrl(value) : null;
    if (url && !urls.includes(url)) urls.push(url);
  }
  return { urls, cost };
}

/** Our server's own copy of a page, or null when it does not answer. */
async function readPage(url: string) {
  try {
    const fetched = await publicFetch(
      url,
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; TheReserveBot/1.0; +https://thereserve.watch)",
          accept: "text/html,application/xhtml+xml",
        },
        signal: AbortSignal.timeout(6_000),
      },
      fetch,
    );
    if (!fetched?.response.ok) {
      await fetched?.response.body?.cancel();
      return null;
    }
    return {
      html: (await fetched.response.text()).slice(0, 1_500_000),
      finalUrl: fetched.finalUrl,
    };
  } catch {
    return null;
  }
}

/** The photo's size from its first 64 KB, or null when unreadable. */
async function photoSize(
  url: string,
): Promise<{ readable: boolean; size: Size }> {
  try {
    const fetched = await publicFetch(
      url,
      {
        headers: { range: "bytes=0-65535" },
        signal: AbortSignal.timeout(5_000),
      },
      fetch,
    );
    if (!fetched?.response.ok) {
      await fetched?.response.body?.cancel();
      return { readable: false, size: null };
    }
    const bytes = new Uint8Array(await fetched.response.arrayBuffer()).subarray(
      0,
      65536,
    );
    return { readable: true, size: imageSize(bytes) };
  } catch {
    return { readable: false, size: null };
  }
}

/** The picture a site gives its home page for sharing: the same picture on
 * a product page says nothing about that product. One read per site. */
const shareImages = new Map<string, Promise<string | null>>();
function siteShareImage(pageUrl: string) {
  const origin = new URL(pageUrl).origin;
  let known = shareImages.get(origin);
  if (!known) {
    known = readPage(`${origin}/`).then((page) => {
      const raw = page?.html.match(
        /<meta[^>]+(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      )?.[1];
      try {
        return raw
          ? asHttps(new URL(raw.replace(/&amp;/g, "&"), origin).toString())
          : null;
      } catch {
        return null;
      }
    });
    shareImages.set(origin, known);
  }
  return known;
}
const withoutQuery = (url: string) => url.split(/[?#]/)[0];

async function tryPhoto(watch: Watch, query: "full" | "short", skip: string[]) {
  const tried: Record<string, unknown>[] = [];
  const { urls, cost } =
    spent + 0.01 <= budgetUsd
      ? await searchPages(watch, query)
      : { urls: [] as string[], cost: 0 };
  // Pages whose address carries the exact reference first (the maker's,
  // then shops, then grey-market dealers), then the rest in the same order,
  // so that a search full of the maker's collection pages still reaches the
  // shops (Jaeger-LeCoultre, Citizen, Bremont in the test run).
  const own = alnum(watch.reference);
  const candidates = [...(watch.sourceUrl ? [watch.sourceUrl] : []), ...urls]
    .filter(
      (url, index, all) => all.indexOf(url) === index && !skip.includes(url),
    )
    .map((url) => ({ url, kind: photoSourceKind(url, watch.brand) }))
    .filter(
      (candidate): candidate is { url: string; kind: PhotoSource } =>
        Boolean(candidate.kind) &&
        !namesAnotherVariant(candidate.url, watch.reference),
    )
    .sort((a, b) => {
      const blocked = (url: string) =>
        BLOCKS_US.test(sourceHost(url) ?? "") ? 1 : 0;
      const exact = (url: string) => (alnum(url).includes(own) ? 0 : 1);
      return (
        blocked(a.url) - blocked(b.url) ||
        exact(a.url) - exact(b.url) ||
        SOURCE_ORDER[a.kind] - SOURCE_ORDER[b.kind]
      );
    })
    .slice(0, 8);
  for (const candidate of candidates) {
    const page = await readPage(candidate.url);
    const referenceFound = page
      ? pageMentionsReference(
          watch.reference,
          // The page's own text: its addresses only echo the one asked for.
          page.html.replace(/https?:\/\/[^\s"'<>]+/gi, " "),
          "",
        ) && !namesAnotherVariant(page.finalUrl, watch.reference)
      : false;
    const offered =
      page && referenceFound
        ? photoAddresses(page.html, page.finalUrl, watch.reference)
        : { addresses: [] as string[], product: null };
    const shared =
      page && offered.addresses.length
        ? await siteShareImage(page.finalUrl)
        : null;
    let chosen: Chosen | null = null;
    for (const address of offered.addresses) {
      if (
        NOT_A_PRODUCT_PHOTO.test(new URL(address).pathname) ||
        namesAnotherVariant(address, watch.reference) ||
        (shared && withoutQuery(shared) === withoutQuery(address))
      )
        continue;
      const shape = await photoSize(address);
      if (!shape.readable || !productPhotoShape(shape.size)) continue;
      const photo = await verifyImageUrl(address, fetch);
      if (photo && page) {
        chosen = {
          pageUrl: page.finalUrl,
          kind: candidate.kind,
          imageUrl: photo,
          size: shape.size,
        };
        break;
      }
    }
    tried.push({
      url: candidate.url,
      kind: candidate.kind,
      reachable: Boolean(page),
      referenceFound,
      offered: offered.addresses.length,
      photo: chosen?.imageUrl ?? null,
    });
    await new Promise((done) => setTimeout(done, 400));
    if (chosen && page)
      return {
        chosen,
        price: pagePrice(page.html, offered.product),
        tried,
        searched: urls.length,
        cost,
      };
  }
  return { chosen: null, price: null, tried, searched: urls.length, cost };
}

async function findPhoto(watch: Watch) {
  const first = await tryPhoto(watch, "full", []);
  if (first.chosen || spent + 0.01 > budgetUsd) return first;
  const second = await tryPhoto(
    watch,
    "short",
    first.tried.map((entry) => String(entry.url)),
  );
  return {
    ...second,
    tried: [...first.tried, ...second.tried],
    searched: first.searched + second.searched,
    cost: first.cost + second.cost,
  };
}

const sql = postgres(process.env.DIRECT_DATABASE_URL!.trim(), {
  max: 1,
  ssl: databaseTls(),
  onnotice: () => undefined,
});

async function store(watch: Watch, chosen: Chosen) {
  const [row] = await sql<{ n: number }[]>`
    select public.watch_catalogue_fact_apply_v1(${watch.id}::uuid, ${run}, ${sql.json(
      [
        {
          field: "imageUrl",
          status: "filled",
          value: chosen.imageUrl,
          method: chosen.kind === "maker" ? "maker_page" : "retailer_page",
          sourceUrl: chosen.pageUrl,
          passage: `${watch.reference} on the page (${chosen.kind}); its product photo`,
          model: "page photo",
        },
      ],
    )}) as n`;
  // Bulk catalogue writes: one writer with a pause (AGENTS.md).
  await new Promise((done) => setTimeout(done, 250));
  return row!.n;
}

if (args.includes("--apply")) {
  const reviewed = JSON.parse(
    readFileSync(`docs/reports/photos-${run}.json`, "utf8"),
  ) as { results: (Watch & { chosen: Chosen | null })[] };
  const skip = (option("--skip") ?? "").split(",").filter(Boolean);
  let stored = 0;
  for (const result of reviewed.results) {
    if (!result.chosen || skip.includes(result.id)) continue;
    // A photo added since the dry run (by the owner or another run) wins.
    const [current] = await sql<{ image: string | null }[]>`
      select image_url as image from private.watch_catalogue where id = ${result.id}::uuid`;
    if (current?.image) continue;
    stored += await store(result, result.chosen);
    console.log(`stored ${result.brand} ${result.reference}`);
  }
  await sql.end();
  console.log(
    `Applied ${stored} photo(s) from docs/reports/photos-${run}.json (run ${run}).`,
  );
  process.exit(0);
}

/**
 * Every approved watch without a photo, until the approved budget is spent
 * (owner, 2026-11-28: "найди для всех часов без фото картинки таким способом
 * и остановись только если деньги закончатся"). The watches the tools show
 * come first (--first, a list from scripts/visible-catalogue.ts), then the
 * other priced watches, AI-found before imported, then the rest. Every
 * attempt is appended to docs/reports/photos-<run>-progress.jsonl, so a
 * stopped run continues where it ended and its spend still counts.
 *
 *   node --env-file=.env --import tsx scripts/find-catalogue-photos.ts --all --run photos-1 \
 *     --first <ids.json> --budget 22 --concurrency 3 --write
 */
async function wholeRun() {
  const progressFile = `docs/reports/photos-${run}-progress.jsonl`;
  const attempted = new Set<string>();
  try {
    for (const line of readFileSync(progressFile, "utf8").split("\n")) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as { id: string; cost?: number };
      attempted.add(entry.id);
      spent += entry.cost ?? 0;
    }
  } catch {
    // The first start of this run.
  }
  const firstFile = option("--first");
  const first = firstFile
    ? (JSON.parse(readFileSync(firstFile, "utf8")) as string[])
    : [];
  const rank = new Map(first.map((id, index) => [id, index]));
  const rows = await sql<(Watch & { priced: boolean })[]>`
    select id, brand, model, reference_code as reference,
      case when source_url ~ '^https://' then source_url end as "sourceUrl",
      (import_source is not null) as imported,
      (price_amount is not null and price_status <> 'unconfirmed') as priced
    from private.watch_catalogue
    where review_status = 'approved' and coalesce(image_url, '') = ''
      and reference_code ~ '[0-9]'`;
  const group = (watch: Watch & { priced: boolean }) =>
    rank.has(watch.id)
      ? 0
      : watch.priced && !watch.imported
        ? 1
        : watch.priced
          ? 2
          : 3;
  const queue = rows
    .filter((watch) => !attempted.has(watch.id))
    .sort(
      (a, b) =>
        group(a) - group(b) ||
        (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0) ||
        a.id.localeCompare(b.id),
    );
  const groups = [0, 1, 2, 3].map(
    (g) => queue.filter((watch) => group(watch) === g).length,
  );
  console.log(
    `queue ${queue.length} (shown by the tools ${groups[0]}, other priced AI-found ${groups[1]}, other priced imported ${groups[2]}, unpriced ${groups[3]}); attempted before ${attempted.size}; spent before $${spent.toFixed(2)} of $${budgetUsd}`,
  );
  const concurrency = Math.min(
    4,
    Math.max(1, Number(option("--concurrency") ?? 3)),
  );
  const reserve = 0.012 * concurrency;
  let done = 0;
  let photos = 0;
  let writing: Promise<unknown> = Promise.resolve();
  const worker = async () => {
    for (;;) {
      if (stopReason) return;
      if (spent + reserve > budgetUsd) {
        stopReason ??= "the approved budget is spent";
        return;
      }
      const watch = queue.shift();
      if (!watch) return;
      let found: Awaited<ReturnType<typeof findPhoto>> & { error?: string };
      try {
        found = await findPhoto(watch);
      } catch (error) {
        found = {
          chosen: null,
          price: null,
          tried: [],
          searched: 0,
          cost: 0,
          error: error instanceof Error ? error.message : String(error),
        };
      }
      const chosen = found.chosen;
      if (chosen && write) {
        // One writer for the whole run, with its pause (AGENTS.md).
        writing = writing
          .then(() => store(watch, chosen))
          .catch((error: unknown) =>
            console.error(
              `write failed for ${watch.id}: ${(error as Error).message}`,
            ),
          );
        await writing;
      }
      if (chosen) photos += 1;
      done += 1;
      appendFileSync(
        progressFile,
        `${JSON.stringify({
          id: watch.id,
          brand: watch.brand,
          reference: watch.reference,
          group: group(watch),
          imageUrl: chosen?.imageUrl ?? null,
          pageUrl: chosen?.pageUrl ?? null,
          kind: chosen?.kind ?? null,
          size: chosen?.size ?? null,
          price: found.price,
          cost: Number(found.cost.toFixed(5)),
          error: found.error ?? null,
          at: new Date().toISOString(),
        })}\n`,
      );
      if (done % 25 === 0)
        console.log(
          `progress ${done} done this start, ${photos} photos, $${spent.toFixed(2)} spent in all, ${queue.length} left`,
        );
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  await writing;
  console.log(
    `Stopped: ${stopReason ?? "every watch tried"}. This start: ${done} watches, ${photos} photos; $${spent.toFixed(2)} spent in all.`,
  );
}

if (args.includes("--all")) {
  await wholeRun();
  await sql.end();
  process.exit(0);
}

// Watches the tools show (approved and priced) without a photo, one per
// brand, in a stable order of their own; most of the gap is in the
// database-imported watches, so seven of ten come from there.
const pick = async (imported: boolean, count: number, skipBrands: string[]) =>
  sql<Watch[]>`
    select id, brand, model, reference, "sourceUrl", imported from (
      select distinct on (brand) id, brand, model, reference_code as reference,
        case when source_url ~ '^https://' then source_url end as "sourceUrl",
        (import_source is not null) as imported, md5(id::text || ${run}) as shuffle
      from private.watch_catalogue
      where review_status = 'approved' and coalesce(image_url, '') = ''
        and reference_code ~ '[0-9]' and price_amount is not null
        and price_status <> 'unconfirmed' and price_amount <= 10000
        and (import_source is not null) = ${imported}
        and not (brand = any(${skipBrands}))
      order by brand, md5(id::text || ${run})
    ) one_per_brand
    order by shuffle limit ${count}`;
const fromImports = await pick(true, Math.ceil(sample * 0.7), []);
const watches = [
  ...fromImports,
  ...(await pick(
    false,
    sample - fromImports.length,
    fromImports.map((watch) => watch.brand),
  )),
];

const results: Record<string, unknown>[] = [];
for (const watch of watches) {
  const found = await findPhoto(watch);
  const applied =
    write && found.chosen ? await store(watch, found.chosen) : null;
  results.push({ ...watch, ...found, applied });
  console.log(
    `${found.chosen ? "PHOTO" : "none "} ${watch.brand} ${watch.model} ${watch.reference}` +
      (found.chosen
        ? ` · ${found.chosen.kind} · ${sourceHost(found.chosen.pageUrl)} · ${found.chosen.size ? `${found.chosen.size.width}×${found.chosen.size.height}` : "size unknown"}`
        : "") +
      (found.price
        ? ` · price on page ${found.price.currency ?? ""} ${found.price.amount}`
        : "") +
      ` · $${found.cost.toFixed(4)}`,
  );
}
await sql.end();
const report = {
  at: new Date().toISOString(),
  run,
  write,
  watches: results.length,
  withPhoto: results.filter((result) => result.chosen).length,
  spentUsd: Number(spent.toFixed(4)),
  results,
};
writeFileSync(
  `docs/reports/photos-${run}.json`,
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(
  `Done: ${report.withPhoto} of ${report.watches} with a photo; $${report.spentUsd}; ${write ? "written" : "dry run"}.`,
);

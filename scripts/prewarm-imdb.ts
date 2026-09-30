// Stores film-search results ahead of time for the IMDb Top 250 movies, the
// IMDb Most Popular 100 TV shows, and their lead actors (lists in
// data/prewarm/, pasted by the owner because IMDb blocks scraping), so
// visitors who search for them get the stored result instantly.
// Already-stored subjects are skipped by the store lookup, so re-running
// only fills gaps. --verify only checks what is stored and runs no search.
//   node --env-file=.env --import tsx scripts/prewarm-imdb.ts [--verify]
import { readFileSync, writeFileSync } from "node:fs";

import {
  normalizeFilmQuery,
  searchFilmWatches,
} from "../app/domain/film-search.server";
import {
  aiSearchCacheKey,
  loadAiWatchStoreConfig,
  loadStoredSearch,
  searchWithStore,
} from "../app/domain/ai-watch-store.server";
import type { FilmSubjectKind } from "../app/domain/film-subject";

type Entry = [title: string, actors: string[]];
const movies = (
  JSON.parse(
    readFileSync("data/prewarm/imdb-top-250-movies-2026-09.json", "utf8"),
  ) as { movies: Entry[] }
).movies;
const series = (
  JSON.parse(
    readFileSync("data/prewarm/imdb-tv-most-popular-2026-09.json", "utf8"),
  ) as { series: Entry[] }
).series;

type Subject = { name: string; kind: FilmSubjectKind };
const seen = new Set<string>();
const subjects: Subject[] = [];
function add(name: string, kind: FilmSubjectKind) {
  const key = `${kind}:${normalizeFilmQuery(name)}`;
  if (seen.has(key)) return;
  seen.add(key);
  subjects.push({ name, kind });
}
for (const [title] of movies) add(title, "movie");
for (const [title] of series) add(title, "series");
for (const [, actors] of [...movies, ...series]) {
  for (const actor of actors) add(actor, "actor");
}

const store = loadAiWatchStoreConfig();
if (!store)
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");

// The same saved-result key the search page uses: the name and its type.
const cacheInputFor = (subject: Subject) => ({
  query: normalizeFilmQuery(subject.name),
  kind: subject.kind,
});

type Row = Subject & { status: string; watches: number; seconds: number };

async function isStored(subject: Subject) {
  const stored = await loadStoredSearch(
    store!,
    aiSearchCacheKey("film", cacheInputFor(subject)),
  );
  return stored ? stored.watches.length : 0;
}

async function prewarm(subject: Subject): Promise<Row> {
  const started = performance.now();
  let status = "error";
  let watches = 0;
  // Up to three tries: a provider hiccup or rate limit should not leave a
  // subject unstored. "no_match" is a real answer and is not retried.
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await searchWithStore({
      kind: "film",
      cacheInput: cacheInputFor(subject),
      run: () => searchFilmWatches(subject.name, {}, subject.kind),
    }).catch(() => ({ status: "unavailable" as const }));
    status = result.status;
    watches = result.status === "found" ? result.watches.length : 0;
    if (status !== "unavailable") break;
    await new Promise((resolve) => setTimeout(resolve, 5_000 * attempt));
  }
  return {
    ...subject,
    status,
    watches,
    seconds: Math.round((performance.now() - started) / 100) / 10,
  };
}

const verifyOnly = process.argv.includes("--verify");
// Film searches make a few Perplexity calls each; 4 at a time stays inside
// the Perplexity rate limit while the catalogue build also runs.
const CONCURRENCY = verifyOnly ? 12 : 4;

const queue = [...subjects];
const rows: Row[] = [];
async function worker() {
  for (let subject = queue.shift(); subject; subject = queue.shift()) {
    const started = performance.now();
    const storedWatches = await isStored(subject).catch(() => 0);
    const row: Row =
      storedWatches > 0
        ? { ...subject, status: "stored", watches: storedWatches, seconds: 0 }
        : verifyOnly
          ? {
              ...subject,
              status: "not stored",
              watches: 0,
              seconds: Math.round((performance.now() - started) / 100) / 10,
            }
          : await prewarm(subject);
    rows.push(row);
    console.log(
      `${String(rows.length).padStart(3)}/${subjects.length} ${`${row.name} (${row.kind})`.padEnd(48)} ${row.status.padEnd(11)} watches=${row.watches}${row.status === "stored" ? "" : ` ${row.seconds}s`}`,
    );
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const ready = rows.filter(
  (row) => row.status === "stored" || row.status === "found",
);
const missing = rows.filter((row) => !ready.includes(row));
const byKind = (kind: FilmSubjectKind) => {
  const all = rows.filter((row) => row.kind === kind);
  return `${all.filter((row) => ready.includes(row)).length}/${all.length}`;
};
const summary = [
  `# IMDb pre-cache ${verifyOnly ? "check" : "run"} (${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC)`,
  "",
  `Stored and served instantly: **${ready.length}/${rows.length}** (movies ${byKind("movie")}, TV shows ${byKind("series")}, actors ${byKind("actor")}).`,
  "",
  "A subject with no stored result runs the live search when a visitor asks for it. Searches that found no watch (no_match) are not stored, so they would search again.",
  "",
  `## Not stored (${missing.length})`,
  "",
  ...(missing.length === 0
    ? ["None."]
    : missing.map((row) => `- ${row.name} (${row.kind}): ${row.status}`)),
  "",
];
const file = `imdb-precache-${verifyOnly ? "check" : "run"}.md`;
writeFileSync(`.catalogue-build/${file}`, summary.join("\n"));
writeFileSync(
  `C:/Users/alexi/OneDrive/Desktop/TheReserve_${file}`,
  summary.join("\n"),
);
console.log(`\n${summary.slice(0, 3).join("\n")}`);

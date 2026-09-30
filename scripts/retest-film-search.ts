// Retests the film / people search (Muse Spark + Perplexity only, no
// catalogue) on a few films, actors, series and famous people. Runs the
// live search directly, bypassing the stored results, and writes the
// outcome to .catalogue-build/film-retest.json for the report.
//   node --env-file=.env --import tsx scripts/retest-film-search.ts
import { mkdirSync, writeFileSync } from "node:fs";

import {
  runSafely,
  searchFilmWatches,
} from "../app/domain/ai-watch-finder.server";

const SUBJECTS: { kind: string; query: string }[] = [
  { kind: "film", query: "Heat" },
  { kind: "film", query: "The Italian Job" },
  { kind: "actor", query: "Jason Momoa" },
  { kind: "actor", query: "Steve McQueen" },
  { kind: "series", query: "Severance" },
  { kind: "series", query: "The Night Manager" },
  { kind: "famous person", query: "Roger Federer" },
  { kind: "famous person", query: "John F. Kennedy" },
];

type Row = {
  kind: string;
  query: string;
  status: string;
  seconds: number;
  watches: {
    name: string;
    person: string | null;
    work: string | null;
    evidence: string;
    photo: boolean;
  }[];
};

const rows: Row[] = [];
for (const subject of SUBJECTS) {
  const started = performance.now();
  const result = await runSafely(() => searchFilmWatches(subject.query));
  const row: Row = {
    ...subject,
    status: result.status,
    seconds: Math.round((performance.now() - started) / 100) / 10,
    watches:
      result.status === "found"
        ? result.watches.map((watch) => ({
            name: `${watch.brand} ${watch.model}${watch.referenceCode ? ` (${watch.referenceCode})` : ""}`,
            person: watch.details.person ?? null,
            work: watch.details.work ?? null,
            evidence: watch.sourceUrl,
            photo: watch.imageUrl !== null,
          }))
        : [],
  };
  rows.push(row);
  console.log(
    `${subject.kind.padEnd(14)} ${subject.query.padEnd(20)} ${row.status.padEnd(11)} ${row.watches.length} watches ${row.seconds}s`,
  );
}
mkdirSync(".catalogue-build", { recursive: true });
writeFileSync(
  ".catalogue-build/film-retest.json",
  JSON.stringify({ ranAt: new Date().toISOString(), rows }, null, 1),
);

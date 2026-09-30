// Runs the film search for well-known subjects ahead of time so visitors
// get stored, instant results. Already-stored subjects are skipped by the
// store lookup, so re-running only fills gaps.
//   npx tsx --env-file=.env scripts/prewarm-film-searches.ts
import {
  normalizeFilmQuery,
  searchFilmWatches,
} from "../app/domain/film-search.server";
import { searchWithStore } from "../app/domain/ai-watch-store.server";

const SUBJECTS = [
  // People and actors
  "Daniel Craig", "Sean Connery", "Roger Moore", "Pierce Brosnan", "Paul Newman",
  "Steve McQueen", "Tom Cruise", "Brad Pitt", "George Clooney", "Leonardo DiCaprio",
  "Ryan Gosling", "Ryan Reynolds", "Keanu Reeves", "Cillian Murphy", "Robert Downey Jr.",
  "Tom Hanks", "Harrison Ford", "Denzel Washington", "Jason Statham", "Matthew McConaughey",
  "Hugh Jackman", "Chris Hemsworth", "Timothée Chalamet", "Zendaya", "Jennifer Aniston",
  "Margot Robbie", "Idris Elba", "Mark Wahlberg", "Dwayne Johnson", "Jake Gyllenhaal",
  "Eddie Redmayne", "Bradley Cooper", "Michael B. Jordan", "Pedro Pascal", "Barack Obama",
  "John F. Kennedy", "Roger Federer", "Rafael Nadal", "Lewis Hamilton", "David Beckham",
  // Fictional characters
  "James Bond", "Indiana Jones", "Tony Stark", "Bruce Wayne", "John Wick",
  "Patrick Bateman", "Don Draper", "Ethan Hunt", "Jason Bourne", "Rick Deckard",
  "Marty McFly", "Gordon Gekko", "Tony Soprano", "Walter White", "Harvey Specter",
  "Thomas Shelby", "Kendall Roy", "Logan Roy", "Jack Bauer", "Sherlock Holmes",
  // Films
  "Casino Royale", "Skyfall", "No Time to Die", "Goldfinger", "Interstellar",
  "Oppenheimer", "Top Gun: Maverick", "Mission: Impossible", "The Thomas Crown Affair", "Le Mans",
  "Apollo 13", "First Man", "Drive", "Wall Street", "American Psycho",
  "Pulp Fiction", "The Dark Knight", "Iron Man", "Tenet", "Inception",
  "The Wolf of Wall Street", "Back to the Future", "Blade Runner", "Die Hard", "Dune",
  // Series
  "Succession", "Mad Men", "The Bear", "Suits", "Peaky Blinders",
  "Breaking Bad", "The Sopranos", "Billions", "Ted Lasso", "The Crown",
  "Mr. Robot", "Stranger Things", "Yellowstone", "Industry", "The White Lotus",
];

// Two at a time: each search makes three Perplexity calls, and the current
// Perplexity usage tier rate-limits bursts.
const CONCURRENCY = 2;

type Row = { subject: string; status: string; watches: number; seconds: number; cached: boolean };

async function run(subject: string): Promise<Row> {
  const started = performance.now();
  const result = await searchWithStore({
    kind: "film",
    cacheInput: { query: normalizeFilmQuery(subject) },
    run: () => searchFilmWatches(subject),
  });
  return {
    subject,
    status: result.status,
    watches: result.status === "found" ? result.watches.length : 0,
    seconds: Math.round((performance.now() - started) / 100) / 10,
    cached: result.status === "found" && result.fromCache,
  };
}

const queue = [...new Set(SUBJECTS)];
const rows: Row[] = [];
async function worker() {
  for (let subject = queue.shift(); subject; subject = queue.shift()) {
    const row = await run(subject);
    rows.push(row);
    console.log(
      `${String(rows.length).padStart(3)}/${SUBJECTS.length} ${row.subject.padEnd(26)} ${row.status.padEnd(11)} watches=${row.watches} ${row.cached ? "already stored" : `${row.seconds}s`}`,
    );
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const found = rows.filter((row) => row.status === "found");
console.log(
  `\nDone: ${found.length}/${rows.length} stored with watches, ${rows.length - found.length} without (not stored, will be retried on the next run).`,
);
for (const row of rows.filter((entry) => entry.status !== "found")) {
  console.log(`  missing: ${row.subject} (${row.status})`);
}

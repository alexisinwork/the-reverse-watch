import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import {
  movieWatchIntakeSummary,
  parseAllMovies,
} from "../app/domain/movie-watch-intake";

const sourcePath = path.resolve(
  process.cwd(),
  "data/knowledge base/All Movies.txt",
);
const rows = parseAllMovies(fs.readFileSync(sourcePath, "utf8"));
const summary = movieWatchIntakeSummary(rows);
console.log(
  `Prepared ${summary.rows} movie/watch intake rows (${summary.uniqueSourceRows} unique source rows).`,
);
console.log(`Review status: unreviewed (${summary.unreviewedRows}).`);

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for the intake import.",
  );
}

let imported = 0;
for (let offset = 0; offset < rows.length; offset += 250) {
  const response = await fetch(
    new URL("/rest/v1/rpc/import_movie_watch_intake_v1", supabaseUrl),
    {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_rows: rows.slice(offset, offset + 250) }),
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!response.ok)
    throw new Error(`Movie/watch intake import returned ${response.status}.`);
  imported += z
    .number()
    .int()
    .nonnegative()
    .parse(await response.json());
}
console.log(`Imported ${imported} rows into the private unreviewed intake.`);

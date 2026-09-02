import { z } from "zod";

import { verifyMovieWatchIntake } from "../app/domain/perplexity-movie-watch-verification.server";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const perplexityApiKey = process.env.PERPLEXITY_API_KEY?.trim();
const limit = Math.min(
  50,
  Math.max(1, Number(process.env.MOVIE_WATCH_MAX_JOBS_PER_RUN || 10)),
);
if (!supabaseUrl || !serviceRoleKey || !perplexityApiKey)
  throw new Error(
    "SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and PERPLEXITY_API_KEY are required.",
  );

const headers = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
};
const rpc = (name: string) => new URL(`/rest/v1/rpc/${name}`, supabaseUrl);
const rowSchema = z.object({
  source_hash: z.string().regex(/^[a-f0-9]{64}$/),
  title_display: z.string(),
  title_original: z.string().nullable(),
  year_start: z.number().nullable(),
  year_end: z.number().nullable(),
  subject_raw: z.string(),
  watch_raw: z.string(),
  context_raw: z.string(),
  affordable_alternative_raw: z.string(),
});

const claim = await fetch(rpc("claim_movie_watch_verification_v1"), {
  method: "POST",
  headers,
  body: JSON.stringify({ p_limit: limit }),
  signal: AbortSignal.timeout(30_000),
});
if (!claim.ok)
  throw new Error(`Movie verification claim returned ${claim.status}.`);
const rows = z.array(rowSchema).parse(await claim.json());
console.log(`Claimed ${rows.length} movie/watch rows for Sonar verification.`);

let succeeded = 0;
for (const row of rows) {
  try {
    const result = await verifyMovieWatchIntake(
      {
        title: row.title_display,
        originalTitle: row.title_original,
        yearStart: row.year_start,
        yearEnd: row.year_end,
        subject: row.subject_raw,
        watches: row.watch_raw,
        context: row.context_raw,
        affordableAlternative: row.affordable_alternative_raw,
      },
      { apiKey: perplexityApiKey },
    );
    const complete = await fetch(rpc("complete_movie_watch_verification_v1"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_source_hash: row.source_hash,
        p_status: "needs_review",
        p_payload: result,
      }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!complete.ok) throw new Error(`completion returned ${complete.status}`);
    succeeded += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    await fetch(rpc("complete_movie_watch_verification_v1"), {
      method: "POST",
      headers,
      body: JSON.stringify({
        p_source_hash: row.source_hash,
        p_status: "needs_review",
        p_payload: null,
        p_error: message.slice(0, 1_000),
      }),
      signal: AbortSignal.timeout(30_000),
    });
    console.error(
      `Verification failed for source row ${row.source_hash.slice(0, 8)}.`,
    );
  }
}
console.log(
  `Stored ${succeeded}/${rows.length} provisional movie/watch dossiers for review.`,
);

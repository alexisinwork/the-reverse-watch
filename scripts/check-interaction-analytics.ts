// Verifies the production analytics RPC and summary inside a rolled-back
// transaction, so this smoke check leaves no synthetic event behind.
import postgres from "postgres";
import { z } from "zod";
const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const sql = postgres(url, {
  max: 1,
  ssl: "require",
  connect_timeout: 10,
  onnotice: () => undefined,
});
let passed = false;
try {
  await sql
    .begin(async (tx) => {
      const session = crypto.randomUUID();
      await tx`select public.record_partner_interaction_v2(${session},null,'result_feedback','quiz','/quiz','result_feedback',null,'smoke-check',null,true,'PL')`;
      const [row] =
        await tx`select public.partner_interaction_analytics_v1(now()-interval '1 day',now()+interval '1 minute',null) as report`;
      const report = z
        .object({
          totals: z.object({
            events: z.number(),
            liked: z.number(),
            sessions: z.number(),
          }),
          byCountry: z.array(
            z.object({ country: z.string(), sessions: z.number() }),
          ),
        })
        .parse(row?.report);
      const totals = report.totals;
      if (
        !totals ||
        totals.events < 1 ||
        totals.liked < 1 ||
        totals.sessions < 1 ||
        !report.byCountry.some((country) => country.country === "PL")
      )
        throw new Error(
          "Analytics aggregate did not include the transactional smoke event",
        );
      throw new Error("ROLLBACK_ANALYTICS_SMOKE");
    })
    .catch((error) => {
      if (
        error instanceof Error &&
        error.message === "ROLLBACK_ANALYTICS_SMOKE"
      ) {
        passed = true;
        return;
      }
      throw error;
    });
} finally {
  await sql.end();
}
if (!passed) throw new Error("Analytics transaction unexpectedly committed");
console.log(
  JSON.stringify({
    result: "passed",
    eventPersisted: false,
    scope:
      "RPC write and admin aggregate exercised in a rolled-back transaction",
  }),
);

// Proves migration 0126 on the real database inside one transaction that is
// always rolled back: the v4 writer stores medium and entry page, replays
// stay idempotent, the newsletter sign-up event is allowed, the summary
// counts each tab session once under its first touch (including a session
// recorded the old way), direct stays its own row, and neither function is
// open to the public roles. Nothing is left behind.
//   node --env-file=.env --import tsx scripts/test-first-touch-attribution.ts
//   ... --applied   (after the migration is applied: test the live functions)
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

import { databaseTls } from "./database-tls";

const url = process.env.DIRECT_DATABASE_URL?.trim();
if (!url) {
  console.error("DIRECT_DATABASE_URL is not set.");
  process.exit(2);
}
const sql = postgres(url, {
  ssl: databaseTls(),
  max: 1,
  connect_timeout: 10,
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
type Row = {
  source: string;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  quizStarts: number;
  quizCompletions: number;
  toolCompletions: number;
  subscriptions: number;
};
try {
  try {
    await sql.begin(async (tx) => {
      await tx`set local lock_timeout='5s'`;
      await tx`set local statement_timeout='20s'`;
      if (!process.argv.includes("--applied"))
        await tx.unsafe(
          await readFile(
            "db/migrations/0126_first_touch_attribution.sql",
            "utf8",
          ),
        );
      // A source no real visitor has, so the summary rows are ours alone.
      const tag = `verify-${randomUUID().slice(0, 8)}`;
      const write = async (
        session: string,
        name: string,
        feature: string,
        page: string,
        source: string | null,
        medium: string | null,
        campaign: string | null,
        landing: string | null,
        eventId = randomUUID(),
      ) => {
        const [r] = await tx<{ result: boolean }[]>`
          select public.record_partner_interaction_v4(${eventId}::uuid,${session}::uuid,null,
            ${name},${feature},${page},null,null,${source},${campaign},null,'PL',${medium},${landing}) result`;
        return r!.result;
      };

      // An Instagram bio visit: /start, then the archetype quiz, a result
      // and a sign-up, all carrying the first touch.
      const instagram = randomUUID();
      const t = [tag, "social", "bio", "/start"] as const;
      assert.equal(
        await write(instagram, "page_view", "site", "/start", ...t),
        true,
      );
      assert.equal(
        await write(
          instagram,
          "quiz_start",
          "archetype",
          "/watches/archetype",
          ...t,
        ),
        true,
      );
      assert.equal(
        await write(
          instagram,
          "service_complete",
          "archetype",
          "/watches/archetype",
          ...t,
        ),
        true,
      );
      const signupId = randomUUID();
      assert.equal(
        await write(
          instagram,
          "newsletter_signup",
          "site",
          "/watches/archetype",
          ...t,
          signupId,
        ),
        true,
      );
      // A replay of the same event is acknowledged once; a changed one is refused.
      assert.equal(
        await write(
          instagram,
          "newsletter_signup",
          "site",
          "/watches/archetype",
          ...t,
          signupId,
        ),
        true,
      );
      assert.equal(
        await write(
          instagram,
          "newsletter_signup",
          "site",
          "/watches/archetype",
          tag,
          "video",
          "bio",
          "/start",
          signupId,
        ),
        false,
      );
      // A second Instagram visit that only looks.
      assert.equal(
        await write(randomUUID(), "page_view", "site", "/start", ...t),
        true,
      );
      // An episode-1 video visit that finishes the film search only.
      const youtube = randomUUID();
      const y = [tag, "video", "ep1", "/watches/find"] as const;
      assert.equal(
        await write(youtube, "page_view", "find", "/watches/find", ...y),
        true,
      );
      assert.equal(
        await write(youtube, "service_complete", "find", "/watches/find", ...y),
        true,
      );
      // A session recorded before 0126 (v3, per-page source, no medium):
      // its first page's source counts, its later untagged page does not.
      const old = randomUUID();
      await tx`select public.record_partner_interaction_v3(${randomUUID()}::uuid,${old}::uuid,null,'page_view','site','/',null,null,${tag},'ep2',null,null)`;
      await tx`select public.record_partner_interaction_v3(${randomUUID()}::uuid,${old}::uuid,null,'quiz_start','quiz','/quiz',null,null,null,null,null,null)`;

      const [stored] = await tx<
        { medium: string; landing: string; n: number }[]
      >`
        select min(traffic_medium) medium,min(landing_page) landing,count(*)::int n
        from public.partner_interaction_events where session_id=${instagram}::uuid`;
      assert.deepEqual(stored, { medium: "social", landing: "/start", n: 4 });

      // Medium and entry page are cleaned, never stored raw.
      const odd = randomUUID();
      await write(
        odd,
        "page_view",
        "site",
        "/",
        tag,
        "Not A Tag",
        null,
        "/start?email=x",
      );
      const [cleaned] = await tx<
        { medium: string | null; landing: string | null }[]
      >`
        select traffic_medium medium,landing_page landing from public.partner_interaction_events where session_id=${odd}::uuid`;
      assert.deepEqual(cleaned, { medium: null, landing: null });

      await assert.rejects(
        tx.savepoint(
          (sp) => sp`
          insert into public.partner_interaction_events(session_id,event_name,feature,page_path)
          values(${randomUUID()}::uuid,'made_up_event','site','/')`,
        ),
        /check constraint/,
      );

      const [summary] = await tx<
        {
          result: {
            rows: Row[];
            byLanding: {
              landing: string;
              sessions: number;
              subscriptions: number;
            }[];
          };
        }[]
      >`
        select public.partner_interaction_attribution_v1(now(),now()+interval '1 millisecond',null) result`;
      const result = summary!.result;
      const ours = result.rows.filter((r) => r.source === tag);
      const find = (medium: string | null, campaign: string | null) =>
        ours.find((r) => r.medium === medium && r.campaign === campaign);
      assert.deepEqual(find("social", "bio"), {
        source: tag,
        medium: "social",
        campaign: "bio",
        sessions: 2,
        quizStarts: 1,
        quizCompletions: 1,
        toolCompletions: 1,
        subscriptions: 1,
      });
      assert.deepEqual(find("video", "ep1"), {
        source: tag,
        medium: "video",
        campaign: "ep1",
        sessions: 1,
        quizStarts: 0,
        quizCompletions: 0,
        toolCompletions: 1,
        subscriptions: 0,
      });
      assert.deepEqual(find(null, "ep2"), {
        source: tag,
        medium: null,
        campaign: "ep2",
        sessions: 1,
        quizStarts: 1,
        quizCompletions: 0,
        toolCompletions: 0,
        subscriptions: 0,
      });
      assert.ok(
        result.byLanding.some(
          (l) => l.landing === "/start" && l.subscriptions >= 1,
        ),
      );

      // A session with no source at all counts as direct.
      await tx`select public.record_partner_interaction_v4(${randomUUID()}::uuid,${randomUUID()}::uuid,null,'page_view','site','/',null,null,'direct',null,null,null,'none','/')`;
      const [repeat] = await tx<{ again: { rows: Row[] } }[]>`
        select public.partner_interaction_attribution_v1(now(),now()+interval '1 millisecond',null) again`;
      assert.ok(
        repeat!.again.rows.some(
          (r) => r.source === "direct" && r.sessions >= 1,
        ),
      );

      await assert.rejects(
        tx.savepoint(
          (sp) =>
            sp`select public.partner_interaction_attribution_v1(now(),now()+interval '91 days',null)`,
        ),
        /Invalid analytics window/,
      );

      const [privileges] = await tx<Record<string, boolean>[]>`
        select
          has_function_privilege('anon','public.record_partner_interaction_v4(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text)','execute') anon_write,
          has_function_privilege('authenticated','public.record_partner_interaction_v4(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text)','execute') user_write,
          has_function_privilege('service_role','public.record_partner_interaction_v4(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text,text,text)','execute') service_write,
          has_function_privilege('anon','public.partner_interaction_attribution_v1(timestamptz,timestamptz,uuid)','execute') anon_read,
          has_function_privilege('authenticated','public.partner_interaction_attribution_v1(timestamptz,timestamptz,uuid)','execute') user_read,
          has_function_privilege('service_role','public.partner_interaction_attribution_v1(timestamptz,timestamptz,uuid)','execute') service_read,
          (public.application_readiness_v4()->>'analyticsDeliveryReady')::boolean ready`;
      assert.deepEqual(privileges, {
        anon_write: false,
        user_write: false,
        service_write: true,
        anon_read: false,
        user_read: false,
        service_read: true,
        ready: true,
      });
      console.log(
        JSON.stringify({
          ok: true,
          mode: process.argv.includes("--applied")
            ? "applied"
            : "migration-in-transaction",
          checks: [
            "v4 writer",
            "idempotent replay",
            "cleaned medium/landing",
            "event-name check",
            "first touch per session",
            "pre-0126 fallback",
            "direct row",
            "window limit",
            "privileges",
            "readiness",
          ],
          rolledBack: true,
        }),
      );
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
} finally {
  await sql.end();
}

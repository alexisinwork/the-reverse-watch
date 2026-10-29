import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { persistInteraction } from "../app/domain/interaction-store.server";
const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: "require",
  max: 1,
  connect_timeout: 10,
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
try {
  try {
    await sql.begin(async (tx) => {
      await tx`set local lock_timeout='5s'`;
      await tx`set local statement_timeout='20s'`;
      if (!process.argv.includes("--applied"))
        await tx.unsafe(
          await readFile(
            "db/migrations/0113_idempotent_interaction_delivery.sql",
            "utf8",
          ),
        );
      const event = randomUUID(),
        session = randomUUID();
      const record = async (helpful: boolean, country = "PL") => {
        const [r] = await tx<
          { result: boolean }[]
        >`select public.record_partner_interaction_v3(${event}::uuid,${session}::uuid,null,'result_feedback','quiz','/quiz','result_feedback',null,'internal-verification',null,${helpful},${country}) result`;
        return r!.result;
      };
      assert.equal(await record(true), true);
      assert.equal(await record(true), true);
      assert.equal(await record(true, "US"), true);
      assert.equal(await record(false), false);
      const [row] = await tx<
        { n: number; helpful: boolean; country: string }[]
      >`select count(*)::int n,bool_and(helpful) helpful,min(country_code) country from public.partner_interaction_events where event_id=${event}::uuid`;
      assert.deepEqual(row, { n: 1, helpful: true, country: "PL" });
      const retryEvent = randomUUID();
      let writes = 0;
      const fetchImpl: typeof fetch = async (_input, init) => {
        if (typeof init?.body !== "string")
          throw new TypeError("Expected JSON request body");
        const payload = JSON.parse(init.body) as {
          p_event_id: string;
        };
        assert.equal(payload.p_event_id, retryEvent);
        const [r] = await tx<
          { result: boolean }[]
        >`select public.record_partner_interaction_v3(${payload.p_event_id}::uuid,${session}::uuid,null,'result_feedback','quiz','/quiz',null,null,null,null,true,'PL') result`;
        if (++writes === 1)
          throw new DOMException(
            "commit acknowledged too late",
            "TimeoutError",
          );
        return Response.json(r!.result);
      };
      assert.equal(
        await persistInteraction(
          {
            config: { supabaseUrl: "https://db.example", serviceKey: "test" },
            fetchImpl,
          },
          { p_event_id: retryEvent },
          async () => {},
        ),
        true,
      );
      assert.equal(writes, 2);
      const [retryRow] = await tx<
        { n: number }[]
      >`select count(*)::int n from public.partner_interaction_events where event_id=${retryEvent}::uuid`;
      assert.equal(retryRow!.n, 1);
      const [readiness] = await tx<
        { ready: boolean }[]
      >`select (public.application_readiness_v4()->>'analyticsDeliveryReady')::boolean ready`;
      assert.equal(readiness!.ready, true);
      const [roles] =
        await tx`select has_function_privilege('anon','public.record_partner_interaction_v3(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text)','execute') anon,has_function_privilege('authenticated','public.record_partner_interaction_v3(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text)','execute') authenticated,has_function_privilege('service_role','public.record_partner_interaction_v3(uuid,uuid,text,text,text,text,text,text,text,text,boolean,text)','execute') service`;
      assert.deepEqual(roles, {
        anon: false,
        authenticated: false,
        service: true,
      });
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Duplicate, lost-acknowledgement retry, changed-vote collision, country preservation and privileges passed; rows rolled back.",
  );
} finally {
  await sql.end();
}

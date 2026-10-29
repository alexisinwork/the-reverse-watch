// Every scenario rolls back, including synthetic catalogue rows, reservations,
// price reviews and snapshots. No provider calls or production data resets.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: {
    rejectUnauthorized: false,
    servername: new URL(process.env.DIRECT_DATABASE_URL!).hostname,
  },
  max: 1,
  connect_timeout: 10,
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
type Reservation = {
  state: string;
  attemptId: string;
  watches: { id: string; referenceCode: string }[];
};
try {
  try {
    await sql.begin(async (tx) => {
      console.log("Connected; starting rolled-back price refresh checks.");
      await tx`set local statement_timeout='20s'`;
      await tx`set local lock_timeout='5s'`;
      if (!process.argv.includes("--applied"))
        await tx.unsafe(
          await readFile(
            "db/migrations/0112_metered_price_refresh.sql",
            "utf8",
          ),
        );
      console.log("Migration available inside the test transaction.");
      const [existing] = await tx<
        { n: number }[]
      >`select count(*)::int as n from private.catalogue_price_recheck_runs where run_date=(now() at time zone 'UTC')::date`;
      // Applied-mode tests use savepoints over the already-created empty run,
      // moving only that fixture-free operational row temporarily out of today.
      if (existing!.n)
        await tx`update private.catalogue_price_recheck_runs set run_date=run_date-10000 where run_date=(now() at time zone 'UTC')::date and state='empty'`;
      const ids = Array.from({ length: 8 }, () => randomUUID());
      const nonce = randomBytes(5).toString("hex");
      for (const [i, id] of ids.entries())
        await tx`insert into private.watch_catalogue(id,identity_key,brand,model,reference_code,reference_confirmed,price_amount,price_currency,price_status,price_checked_at,review_status,source_url)
        values(${id}::uuid,${`price-refresh-fixture|${nonce}|${i}`},'Fixture',${`Fixture ${i}`},${`FIX${nonce}${i}`},true,1000,'USD','approximate','1900-01-01','approved','https://first.example/watch')`;
      // A real unpriced row must never be admitted to this maintenance queue.
      const unpriced = randomUUID();
      await tx`insert into private.watch_catalogue(id,identity_key,brand,model,reference_code,reference_confirmed,review_status)
        values(${unpriced}::uuid,${`price-refresh-unpriced|${nonce}`},'Fixture','Unpriced','UNPRICED123',true,'approved')`;
      const reserve = async (t: typeof tx) => {
        const [row] = await t<
          { r: Reservation }[]
        >`select public.catalogue_price_recheck_reserve_v1() as r`;
        return row!.r;
      };
      const observation = (
        id: string,
        reference: string,
        amount = 1100,
        currency = "USD",
      ) => ({
        id,
        amount,
        currency,
        priceStatus: "approximate",
        evidence: {
          policy: "metered-price-v1",
          priceObservation: {
            value: `${currency} ${amount}`,
            sources: [
              {
                provider: "perplexity",
                value: `${currency} ${amount}`,
                sourceUrl: "https://first.example/watch",
                quote: `Fixture ${reference} market price ${currency} ${amount}`,
                checkedAt: new Date().toISOString(),
              },
              {
                provider: "muse",
                value: `${currency} ${amount}`,
                sourceUrl: "https://second.example/watch",
                quote: `Fixture ${reference} market price ${currency} ${amount}`,
                checkedAt: new Date().toISOString(),
              },
            ],
          },
        },
      });
      const scenario = async (
        name: string,
        run: (sp: typeof tx) => Promise<void>,
      ) => {
        try {
          await tx.savepoint(async (sp) => {
            await run(sp);
            throw rollback;
          });
        } catch (error) {
          if (error !== rollback) throw error;
        }
        console.log(`Passed ${name}; rolled back.`);
      };
      await scenario(
        "daily admission, unpriced exclusion, atomic parking, approximate review and targeted cache invalidation",
        async (sp) => {
          const r = await reserve(sp);
          assert.equal(r.state, "reserved");
          assert.equal(r.watches.length, 8);
          assert.deepEqual(new Set(r.watches.map((w) => w.id)), new Set(ids));
          assert.equal((await reserve(sp)).state, "in_progress");
          const first = r.watches[0]!;
          const [before] = await sp<
            { r: { failed: number; priceRefreshRuns: number } }[]
          >`select public.ai_watch_validation_admin_status_v1() as r`;
          const costs = Array(8).fill(0.008) as number[];
          const result = [observation(first.id, first.referenceCode)];
          const [done] = await sp<
            { r: boolean }[]
          >`select public.catalogue_price_recheck_finish_v1(${r.attemptId}::uuid,${sp.json(result)},${sp.json(costs)}) as r`;
          assert.equal(done!.r, true);
          const [row] = await sp<
            {
              price_amount: string;
              price_change: { amount: number; priceStatus: string };
            }[]
          >`select price_amount,price_change from private.watch_catalogue where id=${first.id}::uuid`;
          assert.equal(Number(row!.price_amount), 1000);
          assert.equal(row!.price_change.amount, 1100);
          assert.equal(row!.price_change.priceStatus, "approximate");
          const [after] = await sp<
            { r: { failed: number; priceRefreshRuns: number } }[]
          >`select public.ai_watch_validation_admin_status_v1() as r`;
          assert.equal(after!.r.failed, before!.r.failed);
          assert.equal(after!.r.priceRefreshRuns, before!.r.priceRefreshRuns);
          assert.equal((await reserve(sp)).state, "already_run");
          const [replay] = await sp<
            { r: boolean }[]
          >`select public.catalogue_price_recheck_finish_v1(${r.attemptId}::uuid,${sp.json(result)},${sp.json(costs)}) as r`;
          assert.equal(replay!.r, true);
          await assert.rejects(
            sp.savepoint(async (bad) => {
              await bad`select public.catalogue_price_recheck_finish_v1(${r.attemptId}::uuid,'[]'::jsonb,${bad.json(costs)})`;
            }),
          );
          const key = randomBytes(32).toString("hex");
          const [a] = await sp<
            { r: { attemptId: string } }[]
          >`select public.ai_watch_validation_reserve_v5(${key},1) as r`;
          await sp`select public.ai_watch_validation_settle_v2(${a!.r.attemptId}::uuid,'[0]'::jsonb)`;
          await sp`insert into private.ai_watch_validated_cache_snapshots(attempt_id,cache_key,summary,watches)
          values(${a!.r.attemptId}::uuid,${key},'Fixture snapshot',${sp.json([{ brand: "Fixture", referenceCode: first.referenceCode }])})`;
          const [accepted] = await sp<
            { r: boolean }[]
          >`select public.watch_catalogue_price_review_v2(${first.id}::uuid,'{"kind":"accept"}'::jsonb) as r`;
          assert.equal(accepted!.r, true);
          const [reviewed] = await sp<
            { price_status: string; price_amount: string }[]
          >`select price_status,price_amount from private.watch_catalogue where id=${first.id}::uuid`;
          assert.equal(reviewed!.price_status, "approximate");
          assert.equal(Number(reviewed!.price_amount), 1100);
          const [cache] = await sp<
            { r: unknown; policy_version: string }[]
          >`select public.ai_watch_validated_cache_get_v2(${key}) as r,policy_version from private.ai_watch_validated_cache_snapshots where cache_key=${key}`;
          assert.equal(cache!.r, null);
          assert.equal(cache!.policy_version, "price-review-invalidated-v1");
        },
      );
      await scenario(
        "settlement failure rolls back pending price writes",
        async (sp) => {
          const r = await reserve(sp);
          const first = r.watches[0]!;
          await assert.rejects(
            sp.savepoint(async (bad) => {
              await bad`select public.catalogue_price_recheck_finish_v1(${r.attemptId}::uuid,${bad.json([observation(first.id, first.referenceCode)])},${bad.json([0.026, 0, 0, 0, 0, 0, 0, 0])})`;
            }),
          );
          const [row] =
            await sp`select price_change from private.watch_catalogue where id=${first.id}::uuid`;
          assert.equal(row!.price_change, null);
          const [attempt] =
            await sp`select state from private.ai_watch_validation_attempts where id=${r.attemptId}::uuid`;
          assert.equal(attempt!.state, "reserved");
        },
      );
      await scenario(
        "price conflicts, unknown identities and concurrent master changes",
        async (sp) => {
          const r = await reserve(sp);
          const first = r.watches[0]!;
          const conflict = observation(first.id, first.referenceCode);
          conflict.evidence.priceObservation.sources[1]!.value = "USD 9000";
          await assert.rejects(
            sp.savepoint(async (bad) => {
              await bad`select public.catalogue_price_recheck_finish_v1(${r.attemptId}::uuid,${bad.json([conflict])},${bad.json(Array(8).fill(0.008))})`;
            }),
          );
          await assert.rejects(
            sp.savepoint(async (bad) => {
              await bad`select public.catalogue_price_recheck_finish_v1(${r.attemptId}::uuid,${bad.json([observation(unpriced, "UNPRICED123")])},${bad.json(Array(8).fill(0.008))})`;
            }),
          );
          await sp`update private.watch_catalogue set updated_at=now()+interval '1 second',price_amount=2000 where id=${first.id}::uuid`;
          await sp`select public.catalogue_price_recheck_finish_v1(${r.attemptId}::uuid,${sp.json([observation(first.id, first.referenceCode)])},${sp.json(Array(8).fill(0.008))})`;
          const [row] =
            await sp`select price_amount,price_change from private.watch_catalogue where id=${first.id}::uuid`;
          assert.equal(Number(row!.price_amount), 2000);
          assert.equal(row!.price_change, null);
        },
      );
      await scenario(
        "abandoned daily worker consumes its full reserve once",
        async (sp) => {
          const r = await reserve(sp);
          await sp`update private.catalogue_price_recheck_runs set created_at=now()-interval '16 minutes' where attempt_id=${r.attemptId}::uuid`;
          assert.equal((await reserve(sp)).state, "already_run");
          const [row] =
            await sp`select state,charged_usd from private.ai_watch_validation_attempts where id=${r.attemptId}::uuid`;
          assert.equal(row!.state, "settled");
          assert.equal(Number(row!.charged_usd), 0.2);
        },
      );
      await scenario("known overruns stay held and halted", async (sp) => {
        const r = await reserve(sp);
        await sp`select public.ai_watch_validation_report_overrun_v1(${r.attemptId}::uuid,'[0.03,0,0,0,0,0,0,0]'::jsonb)`;
        await sp`update private.catalogue_price_recheck_runs set created_at=now()-interval '16 minutes' where attempt_id=${r.attemptId}::uuid`;
        assert.equal((await reserve(sp)).state, "budget_halted");
        const [row] =
          await sp`select state from private.ai_watch_validation_attempts where id=${r.attemptId}::uuid`;
        assert.equal(row!.state, "reserved");
      });
      await scenario(
        "partial monthly remainder and exhausted month",
        async (sp) => {
          await sp`update private.ai_watch_validation_monthly_budget set spent_usd=99.9,reserved_usd=0 where month_start=date_trunc('month',now() at time zone 'UTC')::date`;
          const r = await reserve(sp);
          assert.equal(r.state, "reserved");
          assert.equal(r.watches.length, 4);
        },
      );
      await scenario("exhausted month blocks all admissions", async (sp) => {
        await sp`update private.ai_watch_validation_monthly_budget set spent_usd=99.99,reserved_usd=0 where month_start=date_trunc('month',now() at time zone 'UTC')::date`;
        assert.equal((await reserve(sp)).state, "monthly_limit");
      });
      const [roles] =
        await tx`select bool_and(not has_function_privilege('anon',p.oid,'execute') and not has_function_privilege('authenticated',p.oid,'execute') and has_function_privilege('service_role',p.oid,'execute')) as protected
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('catalogue_price_recheck_reserve_v1','catalogue_price_recheck_finish_v1','watch_catalogue_price_review_v2','application_readiness_v3')`;
      assert.equal(roles!.protected, true);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "All daily price refresh checks passed; no production data changes retained.",
  );
} finally {
  await sql.end();
}

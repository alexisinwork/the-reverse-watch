// Checks migration 0127 (owner decision 2026-11-28, #13): a confirmed price
// that a recheck cannot reproduce becomes approximate at once. Everything runs
// in one transaction that is rolled back: synthetic watches and a synthetic
// daily run only; no provider call, no production row changes.
//
//   node --env-file=.env --import tsx scripts/test-unconfirmed-price.ts            # migration applied inside the test
//   node --env-file=.env --import tsx scripts/test-unconfirmed-price.ts --applied  # after scripts/apply-migration.ts
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import postgres from "postgres";

import { databaseTls } from "./database-tls";

const sql = postgres(process.env.DIRECT_DATABASE_URL!.trim(), {
  ssl: databaseTls(),
  max: 1,
  connect_timeout: 10,
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
const failures: string[] = [];
const check = (name: string, ok: boolean, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures.push(name);
};

try {
  await sql.begin(async (tx) => {
    await tx`set local statement_timeout='20s'`;
    await tx`set local lock_timeout='5s'`;
    if (!process.argv.includes("--applied"))
      await tx.unsafe(
        await readFile(
          "db/migrations/0127_unconfirmed_price_is_approximate.sql",
          "utf8",
        ),
      );
    const nonce = randomBytes(5).toString("hex");
    const fixture = async (name: string, status: string) => {
      const id = randomUUID();
      await tx`insert into private.watch_catalogue(id,identity_key,brand,model,reference_code,reference_confirmed,price_amount,price_currency,price_status,price_checked_at,review_status,source_url)
        values(${id}::uuid,${`unconfirmed-price-fixture|${nonce}|${name}`},'Fixture',${name},${`FIX${nonce}${name}`},true,1000,'USD',${status},'2026-01-01','approved','https://first.example/watch')`;
      return id;
    };
    const row = async (id: string) => {
      const [watch] = await tx<
        { price_status: string; checked: string; attempted: string | null }[]
      >`select price_status, price_checked_at::date::text as checked, price_recheck_attempted_at::text as attempted
        from private.watch_catalogue where id=${id}::uuid`;
      return watch!;
    };

    // 1. The scripted recheck (watch_catalogue_price_v1, kind 'unconfirmed').
    const confirmed = await fixture("A", "confirmed");
    const approximate = await fixture("B", "approximate");
    for (const id of [confirmed, approximate])
      await tx`select public.watch_catalogue_price_v1(${id}::uuid, '{"kind":"unconfirmed"}'::jsonb)`;
    const a = await row(confirmed);
    check(
      "confirmed price becomes approximate",
      a.price_status === "approximate",
      a.price_status,
    );
    check(
      "date of the last good check is kept",
      a.checked === "2026-01-01",
      a.checked,
    );
    check("the attempt is recorded", a.attempted !== null);
    const b = await row(approximate);
    check(
      "approximate price stays approximate",
      b.price_status === "approximate",
      b.price_status,
    );
    check(
      "approximate price keeps its date",
      b.checked === "2026-01-01",
      b.checked,
    );

    // 2. The daily recheck: a completed run with one reproduced price.
    const missed = await fixture("D", "confirmed");
    const reproduced = await fixture("E", "confirmed");
    const changedLater = await fixture("F", "confirmed");
    const [attempt] = await tx<{ id: string }[]>`
      select a.id from private.ai_watch_validation_attempts a
      where a.state='settled' and not exists (
        select 1 from private.catalogue_price_recheck_runs r where r.attempt_id=a.id)
      limit 1`;
    if (!attempt)
      throw new Error("no settled attempt to attach the synthetic run to");
    await tx`insert into private.catalogue_price_recheck_runs(run_date,attempt_id,state,watches,results,finished_at)
      select '1900-01-02'::date, ${attempt.id}::uuid, 'completed',
        jsonb_agg(private.watch_catalogue_json(w) order by w.id),
        jsonb_build_array(jsonb_build_object('id', ${reproduced}::text)), now()
      from private.watch_catalogue w where w.id in (${missed}::uuid, ${reproduced}::uuid, ${changedLater}::uuid)`;
    // F was edited after the run began: it must be left alone.
    await tx`update private.watch_catalogue set updated_at=now()+interval '1 second' where id=${changedLater}::uuid`;
    const [first] = await tx<{ n: number }[]>`
      select public.catalogue_price_recheck_unverified_v1(${attempt.id}::uuid) as n`;
    check("one unverified price changed", first!.n === 1, String(first!.n));
    check(
      "unverified confirmed price becomes approximate",
      (await row(missed)).price_status === "approximate",
    );
    check(
      "reproduced price stays confirmed",
      (await row(reproduced)).price_status === "confirmed",
    );
    check(
      "a watch changed since the run is left alone",
      (await row(changedLater)).price_status === "confirmed",
    );
    const [second] = await tx<{ n: number }[]>`
      select public.catalogue_price_recheck_unverified_v1(${attempt.id}::uuid) as n`;
    check("a second call changes nothing", second!.n === 0, String(second!.n));
    await tx`update private.catalogue_price_recheck_runs set state='validating' where run_date='1900-01-02'`;
    const [unfinished] = await tx<{ n: number }[]>`
      select public.catalogue_price_recheck_unverified_v1(${attempt.id}::uuid) as n`;
    check(
      "an unfinished run changes nothing",
      unfinished!.n === 0,
      String(unfinished!.n),
    );
    const [anon] = await tx<{ allowed: boolean }[]>`
      select has_function_privilege('anon', 'public.catalogue_price_recheck_unverified_v1(uuid)', 'execute') as allowed`;
    check("visitors cannot run the new function", anon!.allowed === false);
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await sql.end();
}
console.log(
  failures.length
    ? `FAIL: ${failures.length} check(s)`
    : "PASS: every check, rolled back",
);
process.exit(failures.length ? 1 : 0);

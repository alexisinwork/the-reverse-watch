// Migration 0124: the catalogue repair writes a fact only through
// watch_catalogue_fact_apply_v1, which logs the value it replaces, and
// watch_catalogue_fact_revert_v1 restores a whole run. Invalid facts are
// refused. Everything runs in a transaction that always rolls back; without
// --applied the migration is applied inside it first.
//
//   node --env-file=.env --import tsx scripts/test-fact-log.ts [--applied]
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";

import postgres from "postgres";

import { databaseTls } from "./database-tls";

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL required");
const migration = await readFile(
  "db/migrations/0124_catalogue_fact_log.sql",
  "utf8",
);
const sql = postgres(url, {
  max: 1,
  ssl: databaseTls(),
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
try {
  await sql.begin(async (tx) => {
    if (!process.argv.includes("--applied")) await tx.unsafe(migration);
    const brand = `Fixture${randomBytes(8).toString("hex")}`;
    const [watch] = await tx<{ id: string }[]>`
      insert into private.watch_catalogue
        (identity_key, brand, model, reference_code, reference_confirmed,
         case_diameter_mm, water_resistance_m, movement, source_url, styles)
      values (${brand}, ${brand}, 'Fixture Diver', 'REF1234', true, 42.5, 200,
              'automatic', 'https://maker.example/ref1234', '{dive}')
      returning id`;
    const id = watch!.id;
    const apply = (run: string, facts: unknown[]) =>
      tx<{ changed: number }[]>`
        select public.watch_catalogue_fact_apply_v1(${id}, ${run}, ${JSON.stringify(facts)}::text::jsonb) as changed`;

    // Two corrections and a confirmation: two columns change, three rows logged.
    const [first] = await apply("test-run", [
      {
        field: "caseDiameterMm",
        status: "corrected",
        value: 41,
        method: "maker_page",
        sourceUrl: "https://maker.example/ref1234",
        passage: "Case diameter 41 mm",
        model: "muse-spark-1.2-contributor",
      },
      {
        field: "waterResistanceM",
        status: "corrected",
        value: 100,
        method: "maker_page",
        sourceUrl: "https://maker.example/ref1234",
        passage: "Water resistance 10 bar",
      },
      {
        field: "movement",
        status: "confirmed",
        value: "automatic",
        method: "maker_page",
        sourceUrl: "https://maker.example/ref1234",
        passage: "Automatic movement",
      },
    ]);
    assert.equal(first!.changed, 2);
    const [after] = await tx<
      {
        case_diameter_mm: string;
        water_resistance_m: number;
        movement: string;
        source_details: { factCheck?: Record<string, string> };
      }[]
    >`select case_diameter_mm, water_resistance_m, movement, source_details
      from private.watch_catalogue where id = ${id}`;
    assert.equal(Number(after!.case_diameter_mm), 41);
    assert.equal(after!.water_resistance_m, 100);
    assert.equal(after!.movement, "automatic");
    assert.match(
      after!.source_details.factCheck?.caseDiameterMm ?? "",
      /^corrected · maker_page · maker\.example · \d{4}-\d{2}-\d{2}$/,
    );
    const log = await tx<{ field: string; old_value: unknown }[]>`
      select field, old_value from private.watch_catalogue_fact_log
      where watch_id = ${id} order by id`;
    assert.deepEqual(
      log.map((row) => row.field),
      ["caseDiameterMm", "waterResistanceM", "movement"],
    );
    assert.equal(Number(log[0]!.old_value), 42.5);
    assert.equal(log[1]!.old_value, 200);

    // A second run changes the model and parks the price; reverting it
    // restores only its own changes.
    await apply("test-run-two", [
      {
        field: "model",
        status: "corrected",
        value: "Fixture Pilot",
        method: "maker_page",
        sourceUrl: "https://maker.example/ref1234",
        passage: "Fixture Pilot REF1234",
      },
      {
        field: "priceStatus",
        status: "corrected",
        value: "unconfirmed",
        method: "derived",
      },
      {
        field: "referenceConfirmed",
        status: "corrected",
        value: false,
        method: "derived",
      },
    ]);
    const [restored] = await tx<{ count: number }[]>`
      select public.watch_catalogue_fact_revert_v1('test-run-two') as count`;
    assert.equal(restored!.count, 3);
    const [back] = await tx<
      {
        model: string;
        price_status: string;
        reference_confirmed: boolean;
        case_diameter_mm: string;
      }[]
    >`select model, price_status, reference_confirmed, case_diameter_mm
      from private.watch_catalogue where id = ${id}`;
    assert.equal(back!.model, "Fixture Diver");
    assert.equal(back!.reference_confirmed, true);
    assert.equal(Number(back!.case_diameter_mm), 41);

    // The first run reverts to the original record.
    await tx`select public.watch_catalogue_fact_revert_v1('test-run')`;
    const [original] = await tx<
      { case_diameter_mm: string; water_resistance_m: number }[]
    >`
      select case_diameter_mm, water_resistance_m from private.watch_catalogue where id = ${id}`;
    assert.equal(Number(original!.case_diameter_mm), 42.5);
    assert.equal(original!.water_resistance_m, 200);

    // Refused: an unknown field, an invalid movement, a non-https page, a bad run name.
    for (const [run, facts] of [
      [
        "test-run",
        [{ field: "price", status: "corrected", value: 1, method: "derived" }],
      ],
      [
        "test-run",
        [
          {
            field: "movement",
            status: "corrected",
            value: "kinetic",
            method: "maker_page",
          },
        ],
      ],
      [
        "test-run",
        [
          {
            field: "sourceUrl",
            status: "corrected",
            value: "http://x.example",
            method: "maker_page",
          },
        ],
      ],
      [
        "Bad Run",
        [
          {
            field: "movement",
            status: "confirmed",
            value: "quartz",
            method: "maker_page",
          },
        ],
      ],
    ] as const) {
      await tx
        .savepoint(async (inner) => {
          await assert.rejects(
            inner`select public.watch_catalogue_fact_apply_v1(${id}, ${run}, ${JSON.stringify(facts)}::text::jsonb)`,
          );
        })
        .catch((error: unknown) => {
          if (error instanceof assert.AssertionError) throw error;
        });
    }

    // Only the server role may call the functions.
    const grants = await tx<{ role: string; ok: boolean }[]>`
      select r.role, has_function_privilege(r.role, 'public.watch_catalogue_fact_apply_v1(uuid, text, jsonb)', 'execute') as ok
      from (values ('anon'), ('authenticated'), ('service_role'), ('reserve_eval_reader')) as r(role)
      where exists (select 1 from pg_roles where rolname = r.role)`;
    for (const grant of grants)
      assert.equal(
        grant.ok,
        grant.role === "service_role",
        `${grant.role} execute`,
      );
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally {
  await sql.end();
}
console.log(
  "PASS: migration 0124 logs, applies and reverts facts, and refuses invalid ones.",
);

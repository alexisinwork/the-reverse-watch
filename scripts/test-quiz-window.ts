// Checks migration 0115 against the real database inside one transaction
// that is always rolled back: permissions, the quiz window's filters and
// columns, full-row reads, pool lookups and identity keys. Before the
// migration is applied it creates the functions inside the same transaction,
// so it runs both before and after deployment.
//
//   node --env-file=.env --import tsx scripts/test-quiz-window.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";
import { z } from "zod";

import { databaseTls } from "./database-tls";
import {
  catalogueWatchSchema,
  QUIZ_WINDOW_COLUMNS,
} from "../app/domain/watch-catalogue";

const url = process.env.DIRECT_DATABASE_URL?.trim();
if (!url) {
  throw new Error("DIRECT_DATABASE_URL is not set.");
}
const sql = postgres(url, {
  ssl: databaseTls(),
  max: 1,
  onnotice: () => undefined,
});
const rows = (value: unknown) => z.array(catalogueWatchSchema).parse(value);
const windowSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
});
const rollback = new Error("expected rollback");
const SIGNATURES = [
  "public.watch_catalogue_quiz_window_v1(jsonb,numeric,numeric,boolean)",
  "public.watch_catalogue_rows_by_id_v1(uuid[])",
  "public.watch_catalogue_pool_lookup_v1(text[],jsonb)",
  "public.watch_catalogue_pool_identity_keys_v1()",
];

try {
  try {
    await sql.begin(async (tx) => {
      const [existing] = await tx<{ exists: boolean }[]>`
        select to_regprocedure(${SIGNATURES[0]!}) is not null as exists`;
      const appliedBefore = existing!.exists;
      if (!appliedBefore) {
        await tx.unsafe(
          readFileSync(
            path.resolve("db/migrations/0115_quiz_catalogue_window_reads.sql"),
            "utf8",
          ),
        );
      }

      for (const signature of SIGNATURES) {
        const [permissions] = await tx`
          select has_function_privilege('anon', ${signature}, 'execute') as anon,
                 has_function_privilege('authenticated', ${signature}, 'execute') as authenticated,
                 has_function_privilege('service_role', ${signature}, 'execute') as service`;
        assert.deepEqual(
          permissions,
          { anon: false, authenticated: false, service: true },
          signature,
        );
      }

      // Synthetic fixtures, all removed by the rollback below.
      const marker = `Window fixture ${crypto.randomUUID().slice(0, 8)}`;
      const fixture = async (
        suffix: string,
        values: {
          price?: number | null;
          currency?: string | null;
          status?: string;
          diameter?: number | null;
          movement?: string | null;
          review?: string;
          source?: string | null;
          caseback?: string | null;
          strap?: string | null;
        },
      ) => {
        const reference = `WIN${suffix}`;
        const [row] = await tx<{ id: string }[]>`
          insert into private.watch_catalogue (
            identity_key, brand, model, reference_code, reference_confirmed,
            styles, case_diameter_mm, movement, source_url, review_status,
            price_amount, price_currency, price_status, caseback_material,
            strap_material
          ) values (
            ${`${marker}|r:${reference}`}, ${marker}, ${`Model ${suffix}`},
            ${reference}, true, array['everyday'],
            ${values.diameter === undefined ? 40 : values.diameter},
            ${values.movement === undefined ? "automatic" : values.movement},
            ${values.source === undefined ? `https://example.com/${reference}` : values.source},
            ${values.review ?? "approved"},
            ${values.price === undefined ? 1_500 : values.price},
            ${values.currency === undefined ? "USD" : values.currency},
            ${values.status ?? "approximate"},
            ${values.caseback ?? null}, ${values.strap ?? null}
          ) returning id`;
        return row!.id;
      };
      const inside = await fixture("IN", {});
      const insideEur = await fixture("EUR", { price: 1_300, currency: "EUR" });
      const nearSize = await fixture("NEAR", { diameter: 42.5 });
      const tooBig = await fixture("BIG", { diameter: 43.5 });
      const tooDear = await fixture("DEAR", { price: 2_100 });
      const noMovement = await fixture("NOMOV", { movement: null });
      const rejected = await fixture("REJ", { review: "rejected" });
      const unconfirmed = await fixture("UNC", { status: "unconfirmed" });
      const noSource = await fixture("NOSRC", { source: null });
      const nickelReady = await fixture("NI", {
        caseback: "titanium",
        strap: "rubber",
      });

      await tx`set local role service_role`;
      const bounds = sql.json([
        { currency: "USD", minimum: 1_000, maximum: 2_000 },
        { currency: "usd", minimum: 1_200, maximum: 1_800 },
        { currency: "EUR", minimum: 900, maximum: 1_800 },
      ]);
      const [result] = await tx`
        select public.watch_catalogue_quiz_window_v1(${bounds}::jsonb, 36.999, 42.501, false) as value`;
      const window = windowSchema.parse(result!.value);
      assert.deepEqual(window.columns, [...QUIZ_WINDOW_COLUMNS]);
      const ids = new Set(window.rows.map((row) => String(row[0])));
      for (const id of [inside, insideEur, nearSize, nickelReady]) {
        assert.ok(ids.has(id), "an in-window fixture is returned");
      }
      for (const id of [
        tooBig,
        tooDear,
        noMovement,
        rejected,
        unconfirmed,
        noSource,
      ]) {
        assert.ok(!ids.has(id), "an out-of-window fixture is excluded");
      }
      for (const row of window.rows) {
        assert.equal(row.length, QUIZ_WINDOW_COLUMNS.length);
      }
      // Order matches the old full read: brand, model, id.
      const markerRows = window.rows
        .filter((row) => row[2] === marker)
        .map((row) => String(row[3]));
      assert.deepEqual(markerRows, [...markerRows].sort());

      const [nickel] = await tx`
        select public.watch_catalogue_quiz_window_v1(${bounds}::jsonb, 36.999, 42.501, true) as value`;
      const nickelIds = new Set(
        windowSchema.parse(nickel!.value).rows.map((row) => String(row[0])),
      );
      assert.ok(nickelIds.has(nickelReady));
      assert.ok(!nickelIds.has(inside), "unknown materials are excluded");

      const [full] = await tx`
        select public.watch_catalogue_rows_by_id_v1(${[inside, rejected, unconfirmed]}::uuid[]) as value`;
      // A hand-added row without a confirmed price is still in the
      // recommendation pool; a rejected one never is.
      assert.deepEqual(
        rows(full!.value)
          .map((row) => row.id)
          .sort(),
        [inside, unconfirmed].sort(),
        "full rows come only from the recommendation pool",
      );

      const [lookup] = await tx`
        select public.watch_catalogue_pool_lookup_v1(
          ${[`${marker}|r:WINEUR`]}::text[],
          ${sql.json([{ brand: marker.toUpperCase(), referenceCode: "win-in" }])}::jsonb
        ) as value`;
      assert.deepEqual(
        rows(lookup!.value)
          .map((row) => row.id)
          .sort(),
        [inside, insideEur].sort(),
      );

      const [keys] = await tx`
        select public.watch_catalogue_pool_identity_keys_v1() as value`;
      const keySet = new Set(z.array(z.string()).parse(keys!.value));
      assert.ok(keySet.has(`${marker}|r:WININ`));
      assert.ok(!keySet.has(`${marker}|r:WINREJ`));

      console.log(
        `Migration 0115 ${appliedBefore ? "(applied)" : "(created in this transaction)"}: ` +
          `permissions, window filters and columns (${window.rows.length} rows for USD 1,000–2,000, 37–42.5 mm), ` +
          `full-row reads, lookups and ${keySet.size} pool identity keys passed.`,
      );
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) {
      throw error;
    }
  }
  console.log("All fixtures rolled back.");
} finally {
  await sql.end();
}

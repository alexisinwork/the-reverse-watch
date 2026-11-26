// Checks migration 0117 against the real database inside one transaction
// that is always rolled back. Before the migration is applied it creates the
// functions inside the same transaction, so it runs before and after deployment.
//
//   node --env-file=.env --import tsx scripts/test-alternatives-window.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";
import { z } from "zod";

import { databaseTls } from "./database-tls";
import {
  ALTERNATIVE_WINDOW_COLUMNS,
  NAME_INDEX_COLUMNS,
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
const windowSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
});
const rollback = new Error("expected rollback");
const SIGNATURES = [
  "public.watch_catalogue_name_index_v1()",
  "public.watch_catalogue_alternatives_window_v1(jsonb,text[],numeric,numeric,numeric,boolean)",
];

try {
  try {
    await sql.begin(async (tx) => {
      const [existing] = await tx<{ exists: boolean }[]>`
        select to_regprocedure(${SIGNATURES[1]!}) is not null as exists`;
      const appliedBefore = existing!.exists;
      if (!appliedBefore) {
        await tx.unsafe(
          readFileSync(
            path.resolve("db/migrations/0117_alternatives_catalogue_reads.sql"),
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

      const marker = `Alternative fixture ${crypto.randomUUID().slice(0, 8)}`;
      const fixture = async (
        suffix: string,
        values: {
          price?: number | null;
          status?: string;
          styles?: string[];
          diameter?: number | null;
          water?: number | null;
          movement?: string | null;
          preowned?: boolean;
          review?: string;
        },
      ) => {
        const reference = `ALT${suffix}`;
        const [row] = await tx<{ id: string }[]>`
          insert into private.watch_catalogue (
            identity_key, brand, model, reference_code, reference_confirmed,
            styles, case_diameter_mm, water_resistance_m, movement, source_url,
            review_status, price_amount, price_currency, price_status,
            preowned_price
          ) values (
            ${`${marker}|r:${reference}`}, ${marker}, ${`Model ${suffix}`},
            ${reference}, true, ${values.styles ?? ["dive"]},
            ${values.diameter === undefined ? 40 : values.diameter},
            ${values.water === undefined ? 300 : values.water},
            ${values.movement === undefined ? "automatic" : values.movement},
            ${`https://example.com/${reference}`}, ${values.review ?? "approved"},
            ${values.price === undefined ? 1_500 : values.price}, 'USD',
            ${values.status ?? "approximate"},
            ${
              values.preowned
                ? sql.json({
                    currency: "USD",
                    low: 900,
                    median: 1_000,
                    high: 1_100,
                    listings: 3,
                    checkedAt: "2026-11-01T00:00:00Z",
                  })
                : null
            }
          ) returning id`;
        return row!.id;
      };
      const inside = await fixture("IN", {});
      const usedOnly = await fixture("USED", { price: 9_000, preowned: true });
      const dear = await fixture("DEAR", { price: 9_000 });
      const unconfirmed = await fixture("UNC", { status: "unconfirmed" });
      const otherStyle = await fixture("STY", { styles: ["dress"] });
      const tooBig = await fixture("BIG", { diameter: 43.5 });
      const shallow = await fixture("SHAL", { water: 100 });
      const quartz = await fixture("QTZ", { movement: "quartz" });
      const rejected = await fixture("REJ", { review: "rejected" });

      await tx`set local role service_role`;
      const [result] = await tx`
        select public.watch_catalogue_alternatives_window_v1(
          ${sql.json([{ currency: "USD", minimum: 1_000, maximum: 3_000 }])}::jsonb,
          ${["dive"]}::text[], 36.999, 43.001, 200, true
        ) as value`;
      const window = windowSchema.parse(result!.value);
      assert.deepEqual(window.columns, [...ALTERNATIVE_WINDOW_COLUMNS]);
      const ids = new Set(window.rows.map((row) => String(row[0])));
      for (const id of [inside, usedOnly]) {
        assert.ok(ids.has(id), "a possible alternative is returned");
      }
      for (const id of [
        dear,
        unconfirmed,
        otherStyle,
        tooBig,
        shallow,
        quartz,
        rejected,
      ]) {
        assert.ok(!ids.has(id), "an impossible alternative is excluded");
      }
      const [open] = await tx`
        select public.watch_catalogue_alternatives_window_v1(
          ${sql.json([{ currency: "USD", minimum: 1_000, maximum: 3_000 }])}::jsonb,
          ${["dive"]}::text[], null, null, null, false
        ) as value`;
      const openIds = new Set(
        windowSchema.parse(open!.value).rows.map((row) => String(row[0])),
      );
      for (const id of [inside, tooBig, shallow, quartz]) {
        assert.ok(openIds.has(id), "inactive limits do not filter");
      }

      const [index] =
        await tx`select public.watch_catalogue_name_index_v1() as value`;
      const names = windowSchema.parse(index!.value);
      assert.deepEqual(names.columns, [...NAME_INDEX_COLUMNS]);
      const indexIds = new Set(names.rows.map((row) => String(row[0])));
      assert.ok(indexIds.has(inside) && !indexIds.has(rejected));

      console.log(
        `Migration 0117 ${appliedBefore ? "(applied)" : "(created in this transaction)"}: ` +
          `permissions, window filters, pre-owned rows, inactive limits, columns ` +
          `and a ${names.rows.length}-row name index passed.`,
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

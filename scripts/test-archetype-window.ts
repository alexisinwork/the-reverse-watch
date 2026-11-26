// Checks migration 0116 against the real database inside one transaction
// that is always rolled back. Before the migration is applied it creates the
// function inside the same transaction, so it runs before and after deployment.
//
//   node --env-file=.env --import tsx scripts/test-archetype-window.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";
import { z } from "zod";

import { databaseTls } from "./database-tls";
import { ARCHETYPE_WINDOW_COLUMNS } from "../app/domain/watch-catalogue";

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
const SIGNATURE =
  "public.watch_catalogue_archetype_window_v1(jsonb,text[],text[],text[])";

try {
  try {
    await sql.begin(async (tx) => {
      const [existing] = await tx<{ exists: boolean }[]>`
        select to_regprocedure(${SIGNATURE}) is not null as exists`;
      const appliedBefore = existing!.exists;
      if (!appliedBefore) {
        await tx.unsafe(
          readFileSync(
            path.resolve(
              "db/migrations/0116_archetype_catalogue_window_read.sql",
            ),
            "utf8",
          ),
        );
      }
      const [permissions] = await tx`
        select has_function_privilege('anon', ${SIGNATURE}, 'execute') as anon,
               has_function_privilege('authenticated', ${SIGNATURE}, 'execute') as authenticated,
               has_function_privilege('service_role', ${SIGNATURE}, 'execute') as service`;
      assert.deepEqual(permissions, {
        anon: false,
        authenticated: false,
        service: true,
      });

      const marker = `Archetype fixture ${crypto.randomUUID().slice(0, 8)}`;
      const fixture = async (
        suffix: string,
        values: {
          price?: number;
          status?: string;
          confirmed?: boolean;
          styles?: string[];
          foundIn?: unknown[];
          movement?: string | null;
          shape?: string | null;
        },
      ) => {
        const reference = `ARC${suffix}`;
        const [row] = await tx<{ id: string }[]>`
          insert into private.watch_catalogue (
            identity_key, brand, model, reference_code, reference_confirmed,
            styles, case_diameter_mm, movement, case_shape, source_url,
            review_status, price_amount, price_currency, price_status, found_in
          ) values (
            ${`${marker}|r:${reference}`}, ${marker}, ${`Model ${suffix}`},
            ${reference}, ${values.confirmed ?? true},
            ${values.styles ?? ["field"]}, 40,
            ${values.movement === undefined ? "automatic" : values.movement},
            ${values.shape === undefined ? "round" : values.shape},
            ${`https://example.com/${reference}`}, 'approved',
            ${values.price ?? 3_000}, 'USD', ${values.status ?? "approximate"},
            ${sql.json((values.foundIn ?? [{ source: "dials", url: "https://example.com" }]) as never)}
          ) returning id`;
        return row!.id;
      };
      const inside = await fixture("IN", {});
      const enriched = await fixture("ENR", {
        foundIn: ["text", { other: 1 }, { source: "catalogue_enrichment" }],
      });
      const otherSource = await fixture("SRC", {
        foundIn: [{ source: "manual" }],
      });
      const unconfirmedReference = await fixture("REF", { confirmed: false });
      const unconfirmedPrice = await fixture("UNC", { status: "unconfirmed" });
      const outsideBand = await fixture("BAND", { price: 6_000 });
      const otherStyle = await fixture("STY", { styles: ["dress"] });
      const quartz = await fixture("QTZ", { movement: "quartz" });
      const square = await fixture("SQ", { shape: "square" });

      await tx`set local role service_role`;
      const bounds = sql.json([
        { currency: "USD", minimum: 2_000, maximum: 5_000 },
      ]);
      const read = async (
        styles: string[],
        movements: string[] = [],
        shapes: string[] = [],
      ) => {
        const [result] = await tx`
          select public.watch_catalogue_archetype_window_v1(
            ${bounds}::jsonb, ${styles}::text[], ${movements}::text[], ${shapes}::text[]
          ) as value`;
        return windowSchema.parse(result!.value);
      };

      const field = await read(["field", "dive", "sport", "travel"]);
      assert.deepEqual(field.columns, [...ARCHETYPE_WINDOW_COLUMNS]);
      const fieldIds = new Set(field.rows.map((row) => String(row[0])));
      for (const id of [inside, enriched, quartz, square]) {
        assert.ok(fieldIds.has(id), "an eligible fixture is returned");
      }
      for (const id of [
        otherSource,
        unconfirmedReference,
        unconfirmedPrice,
        outsideBand,
        otherStyle,
      ]) {
        assert.ok(!fieldIds.has(id), "an ineligible fixture is excluded");
      }
      const enrichedRow = field.rows.find((row) => row[0] === enriched)!;
      const foundIn = enrichedRow[ARCHETYPE_WINDOW_COLUMNS.indexOf("foundIn")];
      assert.deepEqual(
        foundIn,
        [{ source: "catalogue_enrichment" }],
        "foundIn keeps only object entries' source names",
      );
      assert.equal(
        typeof enrichedRow[ARCHETYPE_WINDOW_COLUMNS.indexOf("updatedAt")],
        "string",
      );

      const mechanical = new Set(
        (
          await read(["field"], ["automatic", "manual", "spring_drive"])
        ).rows.map((row) => String(row[0])),
      );
      assert.ok(mechanical.has(inside) && !mechanical.has(quartz));
      const nonRound = new Set(
        (
          await read(
            ["field"],
            [],
            ["square", "rectangular", "tonneau", "cushion"],
          )
        ).rows.map((row) => String(row[0])),
      );
      assert.ok(nonRound.has(square) && !nonRound.has(inside));

      console.log(
        `Migration 0116 ${appliedBefore ? "(applied)" : "(created in this transaction)"}: ` +
          `permissions, filters, columns, source names and update times passed ` +
          `(${field.rows.length} rows for field roles at USD 2,000–5,000).`,
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

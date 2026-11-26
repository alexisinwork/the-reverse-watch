// Checks migrations 0118–0120 (name lookups) against the real database
// inside one transaction that is always rolled back. A migration not yet
// applied is created inside the same transaction, so this runs before and
// after deployment.
//
//   node --env-file=.env --import tsx scripts/test-name-lookups.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import postgres from "postgres";
import { z } from "zod";

import { databaseTls } from "./database-tls";
import {
  foldName,
  nameCandidateQuery,
} from "../app/domain/alternatives.server";
import { NAME_INDEX_COLUMNS } from "../app/domain/watch-catalogue";

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
  "public.watch_catalogue_named_v2(text,text)",
  "public.watch_catalogue_name_candidates_v2(text,text[],integer,text[])",
];
const runs = (value: string) => value.match(/[a-z0-9]+/g) ?? [];

// Every Unicode code point except U+0000, the surrogates and the space,
// in chunks separated by spaces. A space is a starter, so decomposing the
// chunk decomposes each code point on its own.
const chunks: string[] = [];
{
  let points: string[] = [];
  for (let point = 1; point <= 0x10ffff; point += 1) {
    if ((point >= 0xd800 && point <= 0xdfff) || point === 0x20) continue;
    points.push(String.fromCodePoint(point));
    if (points.length === 100_000) {
      chunks.push(points.join(" "));
      points = [];
    }
  }
  chunks.push(points.join(" "));
}

try {
  try {
    await sql.begin(async (tx) => {
      // Each migration is created inside this transaction when missing.
      const created: string[] = [];
      for (const [signature, file] of [
        [SIGNATURES[0]!, "0118_name_lookup_indexes.sql"],
        [SIGNATURES[1]!, "0119_faster_name_lookups.sql"],
      ] as const) {
        const [existing] = await tx<{ exists: boolean }[]>`
          select to_regprocedure(${signature}) is not null as exists`;
        if (!existing!.exists) {
          await tx.unsafe(
            readFileSync(path.resolve("db/migrations", file), "utf8"),
          );
          created.push(file.slice(0, 4));
        }
      }
      // 0120 replaces the fold's body with an inlinable one.
      const [fold] = await tx<{ current: boolean }[]>`
        select pg_get_functiondef('private.watch_name_fold(text)'::regprocedure)
          like '%pg_catalog.lower%' as current`;
      if (!fold!.current) {
        await tx.unsafe(
          readFileSync(
            path.resolve("db/migrations/0120_inline_name_fold.sql"),
            "utf8",
          ),
        );
        created.push("0120");
      }
      const appliedBefore = created.length === 0;
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

      // 1. The database's fold and reference key against the code, for
      // every code point.
      let identical = 0;
      for (const chunk of chunks) {
        const [folded] = await tx<{ fold: string; key: string }[]>`
          select private.watch_name_fold(${chunk}) as fold,
                 private.watch_reference_key(${chunk}) as key`;
        assert.deepEqual(
          runs(folded!.fold),
          runs(foldName(chunk)),
          "the database fold keeps the code's letters and digits",
        );
        assert.equal(
          folded!.key,
          chunk.toLowerCase().replace(/[^a-z0-9]/g, ""),
          "the database reference key is the code's",
        );
        if (
          folded!.fold ===
          chunk.normalize("NFD").replace(/[A-Z]/g, (c) => c.toLowerCase())
        )
          identical += 1;
      }
      // Plain ASCII skips decomposition (migration 0119): only A–Z change.
      const ascii = Array.from({ length: 127 }, (_, i) =>
        String.fromCharCode(i + 1),
      ).join("");
      const [plain] = await tx<{ fold: string }[]>`
        select private.watch_name_fold(${ascii}) as fold`;
      assert.equal(
        plain!.fold,
        ascii.replace(/[A-Z]/g, (c) => c.toLowerCase()),
        "an ASCII name is only lowercased",
      );

      // 2. Fixtures: pool rows, a row outside the pool, a rejected row.
      const marker = `Namefix${crypto.randomUUID().slice(0, 8)}`;
      const fixture = async (
        model: string,
        reference: string | null,
        values: { pool?: boolean; review?: string } = {},
      ) => {
        const pool = values.pool ?? true;
        const [row] = await tx<{ id: string }[]>`
          insert into private.watch_catalogue (
            identity_key, brand, model, reference_code, reference_confirmed,
            styles, case_diameter_mm, water_resistance_m, movement, source_url,
            review_status, price_amount, price_currency, price_status,
            import_source
          ) values (
            ${`${marker}|${model}|${reference ?? "none"}`}, ${marker}, ${model},
            ${reference}, true, ${["dive"]}, 39, 200, 'automatic',
            ${`https://example.com/${encodeURIComponent(model)}`},
            ${values.review ?? "approved"},
            2000, 'USD', ${pool ? "approximate" : "unconfirmed"},
            ${pool ? null : "name-fixture"}
          ) returning id`;
        return row!.id;
      };
      const fiftyEight = await fixture("Black Bay Fifty-Eight", "M79030N-0001");
      const blackBay = await fixture("Black Bay", "M7941A1A0RU");
      const senator = await fixture("Glashütte Senator", "1-36-01-01");
      const outside = await fixture("Pelagos Outside", "OUT25600", {
        pool: false,
      });
      const rejected = await fixture("Black Bay Rejected", "REJ79030", {
        review: "rejected",
      });

      await tx`set local role service_role`;
      const candidates = async (name: string, reference: string | null) => {
        const query = nameCandidateQuery(name, reference);
        const [result] = await tx`
          select public.watch_catalogue_name_candidates_v2(
            ${query.referenceKey}, ${query.terms}::text[], ${query.minHits},
            ${query.required}::text[]
          ) as value`;
        const window = windowSchema.parse(result!.value);
        assert.deepEqual(window.columns, [...NAME_INDEX_COLUMNS]);
        return window.rows.map((row) => String(row[0]));
      };
      const has = (ids: string[], id: string) => ids.includes(id);

      // "58" finds "Fifty-Eight"; one word may miss in a long name.
      const typed58 = await candidates(`${marker} Black Bay 58`, null);
      assert.ok(has(typed58, fiftyEight), "58 matches Fifty-Eight");
      assert.ok(has(typed58, blackBay), "a near miss is a candidate");
      assert.ok(!has(typed58, rejected), "rejected rows never return");
      assert.ok(!has(typed58, outside), "only pool rows return");
      // A short name needs every word.
      const short = await candidates(`${marker} Senator`, null);
      assert.deepEqual(short, [senator]);
      // A decomposed letter splits a word, exactly as in the code.
      const accented = await candidates(`${marker} Glashütte`, null);
      assert.ok(has(accented, senator), "Glashütte matches its own spelling");
      // A reference matches however it is punctuated or cased.
      assert.ok(
        has(await candidates("Something else", "m79030n 0001"), fiftyEight),
      );
      // Rows come in the name index's order (brand, model, id).
      const [index] =
        await tx`select public.watch_catalogue_name_index_v1() as value`;
      const position = new Map(
        windowSchema
          .parse(index!.value)
          .rows.map((row, at) => [String(row[0]), at] as const),
      );
      for (const ids of [typed58, accented]) {
        const at = ids.map((id) => position.get(id) ?? -1);
        assert.ok(
          at.every((value) => value >= 0),
          "candidates are pool rows",
        );
        assert.ok(
          at.every((value, i) => i === 0 || value > at[i - 1]!),
          "candidates keep the name index's order",
        );
      }
      // Only filler words: no name search.
      assert.deepEqual(await candidates("the watch", null), []);

      // 3. named_v2 returns exactly what named_v1 returns.
      const named = async (
        version: 1 | 2,
        query: string,
        reference: string | null,
      ) => {
        const [result] =
          version === 1
            ? await tx`select public.watch_catalogue_named_v1(${query}, ${reference}) as value`
            : await tx`select public.watch_catalogue_named_v2(${query}, ${reference}) as value`;
        return result!.value as unknown;
      };
      const namedCases: [string, string | null][] = [
        [`${marker} Black Bay`, null],
        [`${marker.toUpperCase()} black`, null],
        [`${marker} Pelagos`, null],
        [`${marker} Glashütte`, null],
        [`${marker} %_\\`, null],
        [`  ${marker}  `, null],
        ["ab", null],
        [`${marker} Black`, "M79030N-0001"],
        ["anything", "out-25600"],
        ["anything", "REJ79030"],
        ["anything", ""],
      ];
      for (const [query, reference] of namedCases) {
        assert.deepEqual(
          await named(2, query, reference),
          await named(1, query, reference),
          `named_v2 equals named_v1 for ${query} / ${reference}`,
        );
      }
      const outsideNamed = (await named(2, `${marker} Pelagos`, null)) as {
        id: string;
      }[];
      assert.deepEqual(
        outsideNamed.map((row) => row.id),
        [outside],
        "named_v2 still finds watches outside the pool",
      );

      console.log(
        `Migrations 0118–0120 ${appliedBefore ? "(applied)" : `(${created.join(", ")} created in this transaction)`}: ` +
          `permissions; fold and reference key equal the code's for every code point ` +
          `(${chunks.length} chunks, ${identical} byte-identical); aliases, near misses, ` +
          `decomposed letters, references, pool and rejected filters, order; and ` +
          `named_v2 = named_v1 on ${namedCases.length} queries passed.`,
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

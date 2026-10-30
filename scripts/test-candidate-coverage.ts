// Bounded service-only reads, including rejected identities, in a rollback.
import assert from "node:assert/strict";
import postgres from "postgres";
import { z } from "zod";
import { catalogueWatchSchema } from "../app/domain/watch-catalogue";
const rows = (result: unknown) => z.array(catalogueWatchSchema).parse(result);
const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: "require",
  max: 1,
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
try {
  try {
    await sql.begin(async (tx) => {
      for (const signature of [
        "public.watch_catalogue_candidate_lookup_v1(jsonb)",
        "public.watch_catalogue_unpriced_candidates_v1(text[],numeric,numeric,text[])",
      ]) {
        const [permissions] =
          await tx`select has_function_privilege('anon',${signature},'execute') as anon,has_function_privilege('authenticated',${signature},'execute') as authenticated,has_function_privilege('service_role',${signature},'execute') as service`;
        assert.deepEqual(permissions, {
          anon: false,
          authenticated: false,
          service: true,
        });
      }
      const fixture = crypto.randomUUID();
      await tx`insert into private.watch_catalogue(identity_key,brand,model,reference_code,reference_confirmed,styles,case_diameter_mm,movement,source_url,review_status) values (${fixture},'Coverage fixture','Fixture model','COV123',true,array['everyday'],40,'automatic','https://example.com/COV123','rejected')`;
      const [lookup] =
        await tx`select public.watch_catalogue_candidate_lookup_v1('[{"brand":"Coverage fixture","referenceCode":"COV-123"}]'::jsonb) as rows`;
      assert.equal(rows(lookup!.rows).length, 1);
      assert.equal(rows(lookup!.rows)[0]!.reviewStatus, "rejected");
      // This synthetic update is rolled back with the insert; no real row changes.
      await tx`update private.watch_catalogue set review_status='approved' where identity_key=${fixture}`;
      await tx`set local role service_role`;
      const [read] =
        await tx`select public.watch_catalogue_unpriced_candidates_v1(array['everyday'],39,41,array['automatic']) as rows`;
      const unpriced = rows(read!.rows);
      assert.ok(unpriced.length <= 100);
      assert.ok(
        unpriced.some(
          (row: { brand: string }) => row.brand === "Coverage fixture",
        ),
      );
      for (const row of unpriced) {
        assert.notEqual(row.reviewStatus, "rejected");
        assert.ok(
          row.priceAmount === null || row.priceStatus === "unconfirmed",
        );
        assert.ok(
          row.caseDiameterMm !== null &&
            row.caseDiameterMm >= 39 &&
            row.caseDiameterMm <= 41,
        );
        assert.equal(row.movement, "automatic");
      }
      const [wrong] =
        await tx`select public.watch_catalogue_unpriced_candidates_v1(array['everyday'],41,43,array['automatic']) as rows`;
      assert.ok(
        !rows(wrong!.rows).some(
          (row: { brand: string }) => row.brand === "Coverage fixture",
        ),
      );
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Candidate lookup, rejection visibility, bounded unpriced reads, filters and service-only permissions passed; all fixtures rolled back.",
  );
} finally {
  await sql.end();
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import postgres from "postgres";
const sql = postgres(process.env.DIRECT_DATABASE_URL!, {
  ssl: "require",
  max: 1,
  onnotice: () => undefined,
});
const rollback = new Error("expected rollback");
try {
  try {
    await sql.begin(async (tx) => {
      const [before] =
        await tx`select count(*)::integer as n from private.watch_catalogue`;
      if (!process.argv.includes("--applied"))
        await tx.unsafe(
          await readFile(
            "db/migrations/0108_maintain_catalogue_statistics.sql",
            "utf8",
          ),
        );
      const [settings] = await tx<
        { reloptions: string[] }[]
      >`select reloptions from pg_class where oid='private.watch_catalogue'::regclass`;
      assert.ok(
        settings!.reloptions.includes("autovacuum_vacuum_scale_factor=0.05"),
      );
      assert.ok(
        settings!.reloptions.includes("autovacuum_analyze_scale_factor=0.02"),
      );
      const [after] =
        await tx`select count(*)::integer as n from private.watch_catalogue`;
      assert.equal(after!.n, before!.n);
      throw rollback;
    });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  console.log(
    "Catalogue maintenance settings and unchanged row count checked; rolled back.",
  );
} finally {
  await sql.end();
}

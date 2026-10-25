import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { z } from "zod";

const schema = z.object({
  reservedUsd: z.number().nonnegative(),
  calls: z.number().int().nonnegative(),
  processed: z.number().int().nonnegative(),
  enriched: z.number().int().nonnegative(),
  errors: z.number().int().nonnegative(),
  stopped: z.string().nullable(),
  sequence: z.number().int().nonnegative().default(0),
  billing: z
    .object({
      ownerReportedBaselineUsd: z.number().nonnegative(),
      baselineAt: z.string(),
      perplexityReportedUsd: z.number().nonnegative(),
      perplexityUnreportedEstimateUsd: z.number().nonnegative(),
      perplexityPendingUsd: z.number().nonnegative(),
      perplexityCalls: z.number().int().nonnegative(),
      museCalls: z.number().int().nonnegative(),
    })
    .optional(),
});
export type EnrichmentProgress = z.infer<typeof schema>;
const empty = (): EnrichmentProgress => ({
  reservedUsd: 0,
  calls: 0,
  processed: 0,
  enriched: 0,
  errors: 0,
  stopped: null,
  sequence: 0,
});

/** Append-only allowance journal: Windows/OneDrive may lock display snapshots. */
export function createEnrichmentLedger(
  directory: string,
  rename: typeof renameSync = renameSync,
) {
  mkdirSync(directory, { recursive: true });
  const file = path.join(directory, "enrichment-progress.json"),
    temporary = `${file}.tmp`,
    journal = path.join(directory, "enrichment-allowance.jsonl");
  return {
    load(): EnrichmentProgress {
      const candidates: EnrichmentProgress[] = [];
      for (const input of [file, temporary, journal]) {
        if (!existsSync(input)) continue;
        const contents = readFileSync(input, "utf8");
        const entries =
          input === journal ? contents.split("\n").filter(Boolean) : [contents];
        for (const entry of entries) {
          try {
            const parsed = schema.safeParse(JSON.parse(entry));
            if (parsed.success) candidates.push(parsed.data);
          } catch {
            /* A torn final line cannot erase prior reservations. */
          }
        }
      }
      if (
        candidates.length === 0 &&
        [file, temporary, journal].some(existsSync)
      )
        throw new Error(
          "Allowance ledger exists but is unreadable; refusing to reset spending",
        );
      return (
        candidates.sort(
          (a, b) =>
            b.sequence - a.sequence ||
            b.reservedUsd - a.reservedUsd ||
            b.processed - a.processed ||
            b.calls - a.calls,
        )[0] ?? empty()
      );
    },
    save(progress: EnrichmentProgress) {
      progress.sequence++;
      const checked = schema.parse(progress);
      // Fail closed before a paid request if the authoritative append fails.
      appendFileSync(journal, `${JSON.stringify(checked)}\n`);
      try {
        writeFileSync(temporary, `${JSON.stringify(checked, null, 2)}\n`);
        rename(temporary, file);
      } catch {
        /* Journal remains authoritative until a later snapshot refresh. */
      }
    },
  };
}

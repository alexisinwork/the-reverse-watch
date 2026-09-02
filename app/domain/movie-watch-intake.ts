import { createHash } from "node:crypto";
import { z } from "zod";

const yearSchema = z.number().int().min(1888).max(2100).nullable();
const bounded = z.string().trim().min(1).max(2_000);

export const movieWatchIntakeSchema = z
  .object({
    sourceRow: z.number().int().positive(),
    sourceLine: z.number().int().positive(),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    titleDisplay: bounded.max(300),
    titleOriginal: bounded.max(300).nullable(),
    yearStart: yearSchema,
    yearEnd: yearSchema,
    subjectRaw: bounded,
    watchRaw: bounded,
    watchCandidates: z.array(bounded.max(500)).min(1).max(12),
    contextRaw: bounded,
    affordableAlternativeRaw: bounded,
    reviewStatus: z.literal("unreviewed"),
  })
  .strict();

export type MovieWatchIntake = z.infer<typeof movieWatchIntakeSchema>;

function parseYears(value: string) {
  const years = [...value.matchAll(/(?<!\d)(\d{4})(?!\d)/g)].map((match) =>
    Number(match[1]),
  );
  return { yearStart: years[0] ?? null, yearEnd: years[1] ?? years[0] ?? null };
}

function parseTitle(value: string) {
  const cleaned = value.trim();
  const original = cleaned.match(/\(\*([^,*]+)\*/)?.[1]?.trim() ?? null;
  const dateContext = cleaned.match(/\(([^)]*)\)/)?.[1] ?? cleaned;
  return {
    titleDisplay: cleaned
      .replace(/\s*\(\*[^)]*\)\s*$/, "")
      .replace(/^\*\*|\*\*$/g, "")
      .trim(),
    titleOriginal: original,
    ...parseYears(dateContext),
  };
}

function splitCandidates(value: string) {
  return value
    .replace(/^\*\*|\*\*$/g, "")
    .split(/\s+\/\s+/)
    .map((candidate) => candidate.trim())
    .filter(Boolean);
}

export function parseAllMovies(source: string): MovieWatchIntake[] {
  const rows: MovieWatchIntake[] = [];
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    if (!line.startsWith("| **")) continue;
    const columns = line
      .split("|")
      .slice(1, -1)
      .map((column) => column.trim());
    if (columns.length !== 5) {
      throw new Error(
        `All Movies row ${index + 1} has ${columns.length} columns.`,
      );
    }
    const [title, subjectRaw, watchRaw, contextRaw, affordableAlternativeRaw] =
      columns;
    if (
      !title ||
      !subjectRaw ||
      !watchRaw ||
      !contextRaw ||
      !affordableAlternativeRaw
    )
      throw new Error(`All Movies row ${index + 1} contains an empty field.`);
    const parsedTitle = parseTitle(title);
    const sourceHash = createHash("sha256").update(line).digest("hex");
    rows.push(
      movieWatchIntakeSchema.parse({
        sourceRow: rows.length + 1,
        sourceLine: index + 1,
        sourceHash,
        ...parsedTitle,
        subjectRaw,
        watchRaw,
        watchCandidates: splitCandidates(watchRaw),
        contextRaw,
        affordableAlternativeRaw,
        reviewStatus: "unreviewed",
      }),
    );
  }
  return rows;
}

export function movieWatchIntakeSummary(rows: MovieWatchIntake[]) {
  const uniqueRows = new Set(rows.map((row) => row.sourceHash));
  return {
    rows: rows.length,
    uniqueSourceRows: uniqueRows.size,
    duplicateSourceRows: rows.length - uniqueRows.size,
    rowsWithMultipleCandidates: rows.filter(
      (row) => row.watchCandidates.length > 1,
    ).length,
    rowsWithExactReferenceHint: rows.filter((row) =>
      /\b(?:ref\.?|reference|\b[A-Z]{1,4}\d{2,}[A-Z\d-]*)\b/i.test(
        row.watchRaw,
      ),
    ).length,
    unreviewedRows: rows.filter((row) => row.reviewStatus === "unreviewed")
      .length,
  };
}

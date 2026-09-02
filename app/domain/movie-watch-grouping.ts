import type { MovieWatchIntake } from "./movie-watch-intake";

export type GroupedMovieWatchEntry = Pick<
  MovieWatchIntake,
  | "subjectRaw"
  | "watchRaw"
  | "watchCandidates"
  | "contextRaw"
  | "affordableAlternativeRaw"
  | "reviewStatus"
> & {
  sourceRows: number[];
};

export type GroupedMovieWatch = {
  groupKey: string;
  titleDisplay: string;
  titleOriginal: string | null;
  yearStart: number | null;
  yearEnd: number | null;
  sourceRowCount: number;
  duplicateRowsRemoved: number;
  entries: GroupedMovieWatchEntry[];
};

function groupKey(row: MovieWatchIntake) {
  return [
    row.titleOriginal ?? row.titleDisplay,
    row.yearStart ?? "",
    row.yearEnd ?? "",
  ].join("|");
}

function entryKey(
  row: Pick<
    MovieWatchIntake,
    "subjectRaw" | "watchRaw" | "contextRaw" | "affordableAlternativeRaw"
  >,
) {
  return JSON.stringify([
    row.subjectRaw,
    row.watchRaw,
    row.contextRaw,
    row.affordableAlternativeRaw,
  ]);
}

export function groupMovieWatchRows(
  rows: MovieWatchIntake[],
): GroupedMovieWatch[] {
  const groups = new Map<string, GroupedMovieWatch>();
  const entryKeys = new Map<string, Set<string>>();

  for (const row of rows) {
    const key = groupKey(row);
    let group = groups.get(key);
    if (!group) {
      group = {
        groupKey: key,
        titleDisplay: row.titleDisplay,
        titleOriginal: row.titleOriginal,
        yearStart: row.yearStart,
        yearEnd: row.yearEnd,
        sourceRowCount: 0,
        duplicateRowsRemoved: 0,
        entries: [],
      };
      groups.set(key, group);
      entryKeys.set(key, new Set());
    }
    group.sourceRowCount += 1;
    const keySet = entryKeys.get(key)!;
    const candidateKey = entryKey(row);
    const existing = group.entries.find(
      (entry) => entryKey(entry) === candidateKey,
    );
    if (keySet.has(candidateKey) && existing) {
      existing.sourceRows.push(row.sourceRow);
      group.duplicateRowsRemoved += 1;
      continue;
    }
    keySet.add(candidateKey);
    group.entries.push({
      subjectRaw: row.subjectRaw,
      watchRaw: row.watchRaw,
      watchCandidates: row.watchCandidates,
      contextRaw: row.contextRaw,
      affordableAlternativeRaw: row.affordableAlternativeRaw,
      reviewStatus: row.reviewStatus,
      sourceRows: [row.sourceRow],
    });
  }

  return [...groups.values()].sort((a, b) =>
    a.groupKey.localeCompare(b.groupKey, "en", { sensitivity: "base" }),
  );
}

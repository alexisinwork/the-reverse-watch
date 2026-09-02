import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { movieWatchIntakeSummary, parseAllMovies } from "./movie-watch-intake";
import { groupMovieWatchRows } from "./movie-watch-grouping";

const source = fs.readFileSync(
  path.resolve(process.cwd(), "data/knowledge base/All Movies.txt"),
  "utf8",
);

describe("All Movies intake parser", () => {
  it("parses every five-column movie/watch row without publishing it", () => {
    const rows = parseAllMovies(source);
    expect(rows).toHaveLength(2_349);
    expect(rows.every((row) => row.reviewStatus === "unreviewed")).toBe(true);
    expect(rows.every((row) => row.sourceHash.length === 64)).toBe(true);
  });

  it("preserves original titles and separates slash-delimited watch candidates", () => {
    const rows = parseAllMovies(source);
    const drNo = rows[0]!;
    expect(drNo.titleDisplay).toBe("Доктор Ноу");
    expect(drNo.titleDisplay).not.toMatch(/\*\*/);
    expect(drNo.watchCandidates[0]).not.toMatch(/^\*\*|\*\*$/);
    const backToFuture = rows.find((row) =>
      row.titleOriginal?.includes("Back to the Future"),
    );
    expect(backToFuture?.titleDisplay).toContain("Назад в будущее");
    expect(backToFuture?.watchCandidates.length).toBeGreaterThan(0);
    expect(movieWatchIntakeSummary(rows)).toMatchObject({
      rows: 2_349,
      uniqueSourceRows: 2_104,
      unreviewedRows: 2_349,
    });
  });

  it("groups by film and removes repeated evidence rows without merging distinct entries", () => {
    const rows = parseAllMovies(source);
    const groups = groupMovieWatchRows(rows);
    expect(groups).toHaveLength(704);
    expect(groups.reduce((sum, group) => sum + group.sourceRowCount, 0)).toBe(
      2_349,
    );
    expect(
      groups.reduce((sum, group) => sum + group.duplicateRowsRemoved, 0),
    ).toBe(248);
    expect(
      groups.every((group) =>
        group.entries.every((entry) => entry.reviewStatus === "unreviewed"),
      ),
    ).toBe(true);
    expect(
      groups.find((group) => group.titleOriginal === "Peaky Blinders")
        ?.sourceRowCount,
    ).toBe(38);
  });
});

import fs from "node:fs";
import path from "node:path";

import { groupMovieWatchRows } from "../app/domain/movie-watch-grouping";
import { parseAllMovies } from "../app/domain/movie-watch-intake";

const sourcePath = path.resolve(
  process.cwd(),
  "data/knowledge base/All Movies.txt",
);
const outputPath = path.resolve(
  process.cwd(),
  "data/research/all-movies-grouped.json",
);
const rows = parseAllMovies(fs.readFileSync(sourcePath, "utf8"));
const groups = groupMovieWatchRows(rows);

fs.writeFileSync(
  outputPath,
  `${JSON.stringify({ generatedFrom: "data/knowledge base/All Movies.txt", reviewStatus: "unreviewed", sourceRowCount: rows.length, groupCount: groups.length, groups }, null, 2)}\n`,
);
console.log(
  `Wrote ${groups.length} film groups from ${rows.length} source rows to ${path.relative(process.cwd(), outputPath)}`,
);

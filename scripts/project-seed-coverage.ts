import fs from "node:fs";
import path from "node:path";

import { projectSeedCoverage } from "../app/domain/coverage";
import { seedCatalogue } from "../app/domain/seed-catalogue";

const outputPath = path.resolve(
  process.cwd(),
  process.argv[2] ?? "data/coverage/reference-variants.json",
);
const projection = projectSeedCoverage(seedCatalogue);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(projection, null, 2)}\n`);
console.log(
  `Projected ${projection.length} reference variants to ${path.relative(process.cwd(), outputPath)}.`,
);

import fs from "node:fs";
import path from "node:path";

import { coverageCandidateListSchema } from "../app/domain/coverage";
import { planCoverageResearch } from "../app/domain/research-planning";
import { researchManifestSchema } from "../app/domain/research";

const json = process.argv.includes("--json");
const manifestPath = path.resolve(
  process.cwd(),
  "data/research/brand-manifest.json",
);
const coveragePath = path.resolve(
  process.cwd(),
  "data/coverage/reference-variants.json",
);

const manifest = researchManifestSchema.parse(
  JSON.parse(fs.readFileSync(manifestPath, "utf8")),
);
const candidates = coverageCandidateListSchema.parse(
  JSON.parse(fs.readFileSync(coveragePath, "utf8")),
);

const plan = planCoverageResearch(manifest, candidates);

if (json) {
  console.log(JSON.stringify(plan, null, 2));
} else {
  console.log(
    "Coverage research queue (intent is a research hypothesis, not an accepted fact):",
  );
  plan.forEach((target, index) => {
    console.log(
      `${String(index + 1).padStart(2, " ")}. [${target.priority}] ${target.targetId} — score ${target.score}; ` +
        `${target.emptyCells}/${target.targetedCells} empty, ${target.underDiversifiedCells} under-diversified, ${target.underEvidencedCells} under-evidenced`,
    );
  });
}

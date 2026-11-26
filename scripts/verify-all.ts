// One command for the owner to re-check the rebuild: runs every check in
// order and reports PASS, FAIL or NOT RUN for each, with its command.
//
//   node --import tsx scripts/verify-all.ts               # local and database
//   node --import tsx scripts/verify-all.ts --production  # also live site
//
// No check makes a paid provider call. Database checks are read-only or run
// in rolled-back transactions. Production checks count a few uses against
// the owner's test partner site. Writes docs/reports/verify-all-<date>.json.
import { spawnSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Check = {
  name: string;
  command: string[];
  needs: "nothing" | "database" | "production";
  what: string;
};

const tsx = (script: string, ...args: string[]) => [
  "node",
  "--env-file=.env",
  "--import",
  "tsx",
  script,
  ...args,
];

const CHECKS: Check[] = [
  {
    name: "Fast gate",
    command: ["npm", "run", "check"],
    needs: "nothing",
    what: "formatting, lint, types, all unit tests, production build",
  },
  {
    name: "Migration 0115 (quiz window)",
    command: tsx("scripts/test-quiz-window.ts"),
    needs: "database",
    what: "permissions, filters and columns, in a rolled-back transaction",
  },
  {
    name: "Migration 0116 (archetype window)",
    command: tsx("scripts/test-archetype-window.ts"),
    needs: "database",
    what: "permissions, filters and columns, in a rolled-back transaction",
  },
  {
    name: "Migration 0117 (alternatives reads)",
    command: tsx("scripts/test-alternatives-window.ts"),
    needs: "database",
    what: "permissions, filters, name index, in a rolled-back transaction",
  },
  {
    name: "Migrations 0118–0120 (name lookups)",
    command: tsx("scripts/test-name-lookups.ts"),
    needs: "database",
    what: "permissions, every Unicode code point, aliases, near misses, in a rolled-back transaction",
  },
  {
    name: "Migration 0121 (validation backoff)",
    command: tsx("scripts/test-validation-backoff.ts", "--applied"),
    needs: "database",
    what: "waits of 5 minutes, 1 hour, 1 day and 7 days after failed paid checks, in a rolled-back transaction",
  },
  {
    name: "Quiz window equals the whole catalogue",
    command: tsx("scripts/check-quiz-window-equivalence.ts"),
    needs: "database",
    what: "64 answers, 0 differences allowed",
  },
  {
    name: "Archetype window equals the whole catalogue",
    command: tsx("scripts/check-archetype-window-equivalence.ts"),
    needs: "database",
    what: "all 24 archetype and band combinations, 0 differences allowed",
  },
  {
    name: "Alternatives reads equal the whole catalogue",
    command: tsx("scripts/check-alternatives-window-equivalence.ts"),
    needs: "database",
    what: "owner test-set names and budgets, 0 differences allowed",
  },
  {
    name: "Name lookups equal the whole name index",
    command: tsx("scripts/check-name-lookup-equivalence.ts", "--sample", "20"),
    needs: "database",
    what: "a 20-row sample of the full 794-name run: same resolved watch and same named rows, 0 differences allowed",
  },
  {
    name: "Quality evaluation",
    command: tsx("scripts/run-evals.ts"),
    needs: "database",
    what: "0 hard-rule breaks, 0 forbidden sightings, no provider request; scores vs docs/eval-baseline.md",
  },
  {
    name: "Page speed (production)",
    command: [
      "node",
      "--import",
      "tsx",
      "scripts/measure-page-speed.ts",
      "--label",
      "verify",
    ],
    needs: "production",
    what: "first-byte medians and CDN hits for public pages",
  },
  {
    name: "Page JavaScript weight (production)",
    command: [
      "node",
      "--import",
      "tsx",
      "scripts/measure-page-weight.ts",
      "--label",
      "verify",
    ],
    needs: "production",
    what: "compressed JavaScript of the first load within 150 KB on four public pages",
  },
  {
    name: "Search windows smoke (production)",
    command: tsx("scripts/smoke-catalogue-windows.ts"),
    needs: "production",
    what: "saved archetype and alternatives answers; 0 added paid attempts",
  },
  {
    name: "Quiz API speed (production)",
    command: tsx("scripts/measure-quiz-api.ts", "--label", "verify"),
    needs: "production",
    what: "answers the catalogue covers, no provider call",
  },
];

const production = process.argv.includes("--production");
const hasEnv = existsSync(".env");
const results: {
  name: string;
  result: "PASS" | "FAIL" | "NOT RUN";
  seconds: number;
  command: string;
  what: string;
  note?: string;
}[] = [];

for (const check of CHECKS) {
  const command = check.command.join(" ");
  if (check.needs !== "nothing" && !hasEnv) {
    results.push({
      name: check.name,
      result: "NOT RUN",
      seconds: 0,
      command,
      what: check.what,
      note: "no .env with database access",
    });
    continue;
  }
  if (check.needs === "production" && !production) {
    results.push({
      name: check.name,
      result: "NOT RUN",
      seconds: 0,
      command,
      what: check.what,
      note: "pass --production to include",
    });
    continue;
  }
  process.stdout.write(`▶ ${check.name} … `);
  const startedAt = Date.now();
  // The commands are the fixed list above. npm is a .cmd file on Windows,
  // which only cmd.exe can start.
  const options = { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 } as const;
  const run =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", command], options)
      : spawnSync(check.command[0]!, check.command.slice(1), options);
  const seconds = Math.round((Date.now() - startedAt) / 1000);
  const passed = run.status === 0;
  console.log(`${passed ? "PASS" : "FAIL"} (${seconds} s)`);
  const tail = `${run.stdout ?? ""}${run.stderr ?? ""}`
    .split(/\r?\n/)
    .filter((line) => line.trim() && !/postgres(ql)?:\/\//.test(line))
    .slice(-3)
    .join(" | ");
  results.push({
    name: check.name,
    result: passed ? "PASS" : "FAIL",
    seconds,
    command,
    what: check.what,
    ...(passed ? {} : { note: tail.slice(0, 400) }),
  });
}

console.log("");
console.table(
  results.map(({ name, result, seconds, note }) => ({
    check: name,
    result,
    seconds,
    note: note ?? "",
  })),
);
const report = { at: new Date().toISOString(), production, results };
const output = resolve(
  `docs/reports/verify-all-${report.at.slice(0, 10)}.json`,
);
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Wrote ${output}`);
if (results.some((entry) => entry.result === "FAIL")) {
  process.exit(1);
}

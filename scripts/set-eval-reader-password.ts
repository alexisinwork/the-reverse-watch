// Sets the password of the evaluation sign-in reserve_eval_reader
// (migration 0123) and stores its connection string where the CI job
// (.github/workflows/eval.yml) reads it. The owner runs it:
//
//   node --env-file=.env --import tsx scripts/set-eval-reader-password.ts
//
// The password is generated here and never printed. The database receives
// only its SCRAM-SHA-256 verifier. The connection string goes to the GitHub
// Actions secret EVAL_DATABASE_URL through `gh secret set` (on its standard
// input, so it is never part of a command line) and to .env, for local
// runs of scripts/run-evals.ts. Running it again replaces the password.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

import postgres from "postgres";

import { databaseTls } from "./database-tls";
import { EVAL_ROLE, evalReaderUrl, scramVerifier } from "./eval-database";
import { READ_ONLY_RPC } from "./eval-sets";

const adminUrl = process.env.DIRECT_DATABASE_URL?.trim();
if (!adminUrl) {
  console.error("DIRECT_DATABASE_URL is not set in .env.");
  process.exit(2);
}

const password = randomBytes(24).toString("base64url");
const verifier = scramVerifier(password);
if (
  !/^SCRAM-SHA-256\$4096:[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/.test(
    verifier,
  )
) {
  throw new Error("The password verifier has an unexpected form.");
}

const options = {
  max: 1,
  ssl: databaseTls(),
  connect_timeout: 15,
  onnotice: () => undefined,
} as const;

// 1. The password, as its verifier (ALTER ROLE takes no parameters; the
//    verifier holds only base64 characters, checked above).
const admin = postgres(adminUrl, options);
try {
  const [role] = await admin<{ exists: boolean }[]>`
    select exists (select 1 from pg_catalog.pg_roles where rolname = ${EVAL_ROLE}) as exists`;
  if (!role?.exists) {
    console.error(
      `${EVAL_ROLE} does not exist yet: apply db/migrations/0123_eval_reader_role.sql first.`,
    );
    process.exit(2);
  }
  await admin.unsafe(`alter role ${EVAL_ROLE} with password '${verifier}'`);
} finally {
  await admin.end();
}
console.log(`1/3 The password of ${EVAL_ROLE} is set (not shown).`);

// 2. Sign in as the role and check what it can do: exactly the evaluation's
//    functions, in read-only sessions. The pooler can take a few seconds to
//    learn a new password, so the sign-in is retried.
const readerUrl = evalReaderUrl(adminUrl, password);
let checked: { functions: number; readOnly: string } | null = null;
for (let attempt = 1; attempt <= 6 && !checked; attempt += 1) {
  const reader = postgres(readerUrl, options);
  try {
    const [row] = await reader<{ functions: number; read_only: string }[]>`
      select (select count(*)::int
                from pg_catalog.pg_proc p
                join pg_catalog.pg_namespace n on n.oid = p.pronamespace
               where n.nspname = 'public'
                 and pg_catalog.has_function_privilege(p.oid, 'execute')) as functions,
             pg_catalog.current_setting('default_transaction_read_only') as read_only`;
    checked = { functions: row!.functions, readOnly: row!.read_only };
  } catch (error) {
    if (attempt === 6) {
      console.error(
        `Signing in as ${EVAL_ROLE} failed: ${(error as Error).message}`,
      );
      process.exit(1);
    }
    await new Promise((done) => setTimeout(done, 5_000));
  } finally {
    await reader.end();
  }
}
if (
  !checked ||
  checked.functions !== READ_ONLY_RPC.size ||
  checked.readOnly !== "on"
) {
  console.error(
    `${EVAL_ROLE} can run ${checked?.functions} functions (expected ${READ_ONLY_RPC.size}) with read-only sessions "${checked?.readOnly}"; nothing was stored.`,
  );
  process.exit(1);
}
console.log(
  `2/3 Signed in as ${EVAL_ROLE}: it can run exactly the ${checked.functions} evaluation functions, read-only.`,
);

// 3. Store the connection string: .env for local runs, GitHub for the CI job.
const line = `EVAL_DATABASE_URL=${readerUrl}`;
const envText = existsSync(".env") ? readFileSync(".env", "utf8") : "";
const newline = envText.includes("\r\n") ? "\r\n" : "\n";
const kept = envText
  .split(/\r?\n/)
  .filter((entry) => !entry.startsWith("EVAL_DATABASE_URL="));
while (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
writeFileSync(".env", `${[...kept, line].join(newline)}${newline}`);

const github = spawnSync("gh", ["secret", "set", "EVAL_DATABASE_URL"], {
  input: readerUrl,
  encoding: "utf8",
});
if (github.status === 0) {
  console.log(
    "3/3 Stored as EVAL_DATABASE_URL in .env and in the repository's GitHub Actions secrets.",
  );
} else {
  console.log(
    "3/3 Stored as EVAL_DATABASE_URL in .env. GitHub CLI could not store the secret" +
      (github.stderr ? ` (${github.stderr.trim().split("\n")[0]})` : "") +
      ": open the repository on GitHub, Settings, Secrets and variables, Actions," +
      " New repository secret, name EVAL_DATABASE_URL, and paste the value of" +
      " EVAL_DATABASE_URL from .env.",
  );
}

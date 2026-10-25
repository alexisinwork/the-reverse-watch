/** Run the real Reserve and sibling portfolio together, with a dedicated partner. */
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";

import {
  listPartnerSites,
  savePartnerSite,
  type PartnerSite,
} from "../app/domain/partner-sites.server";
import { catalogueClient } from "../app/domain/watch-catalogue.server";

const portfolio = resolve(process.argv[2] ?? "../personal-website");
if (!existsSync(resolve(portfolio, "node_modules/vite/bin/vite.js"))) {
  throw new Error(
    "Install the personal-website dependencies first (npm install --package-lock=false).",
  );
}
const client = catalogueClient();
if (!client)
  throw new Error("Configure the Reserve database in the ignored .env first.");
const name = "Portfolio local integration";
const sites = await listPartnerSites(client);
let site: PartnerSite | undefined = sites.find(
  (candidate) => candidate.name === name,
);
if (!site) {
  site =
    (await savePartnerSite(client, {
      name,
      allowedOrigins: ["http://localhost:8080", "http://127.0.0.1:8080"],
      active: true,
      monthlyQuota: 200,
      theme: {},
      notes:
        "Dedicated local integration test for personal-website; shared catalogue; not a paying customer.",
    })) ?? undefined;
}
if (!site) throw new Error("Could not configure the local partner.");
if (!site.active || !site.allowedOrigins.includes("http://localhost:8080")) {
  throw new Error(
    "Enable Portfolio local integration and register http://localhost:8080 in /admin/sites.",
  );
}
const envPath = resolve(portfolio, ".env.local");
const previous = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const retained = previous
  .split(/\r?\n/)
  .filter((line) => !/^VITE_RESERVE_(ORIGIN|PUBLIC_KEY)=/.test(line))
  .join("\n")
  .trimEnd();
writeFileSync(
  envPath,
  `${retained ? `${retained}\n` : ""}VITE_RESERVE_ORIGIN=http://localhost:5173\nVITE_RESERVE_PUBLIC_KEY=${site.publicKey}\n`,
);

// Do not give the portfolio server the Reserve's database or provider secrets.
const portfolioEnv = { ...process.env };
for (const key of Object.keys(parseEnv(readFileSync(".env", "utf8")))) {
  delete portfolioEnv[key];
}
const children = [
  spawn(
    process.execPath,
    [
      "node_modules/@react-router/dev/bin.js",
      "dev",
      "--host",
      "localhost",
      "--port",
      "5173",
      "--strictPort",
    ],
    {
      stdio: "inherit",
      env: { ...process.env, APP_URL: "http://localhost:5173" },
    },
  ),
  spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "dev",
      "--host",
      "localhost",
      "--port",
      "8080",
      "--strictPort",
    ],
    {
      cwd: portfolio,
      stdio: "inherit",
      env: portfolioEnv,
    },
  ),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
for (const child of children) {
  child.on("error", () => stop(1));
  child.on("exit", (code) => stop(code ?? 1));
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
console.info("Portfolio: http://localhost:8080/watch-advisor-demo");
console.info(
  "Reserve: http://localhost:5173 · Admin: http://localhost:5173/admin/sites",
);
console.info(
  "Uses the configured database and providers. Local tests count toward the dedicated partner's quota.",
);

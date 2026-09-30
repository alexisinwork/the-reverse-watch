// Starts the built app. The Vercel preset names the server folder
// build/server/nodejs_<id>/; this finds it without a shell wildcard, so
// `npm run start` works on Windows too.
import { spawn } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";

const folder = readdirSync("build/server").find((name) =>
  name.startsWith("nodejs_"),
);
if (!folder) throw new Error("No build found: run `npm run build` first.");

// The package does not export its CLI file, so it is found on disk.
const cli = path.resolve("node_modules/@react-router/serve/dist/cli.js");
const child = spawn(
  process.execPath,
  [cli, path.join("build", "server", folder, "index.js")],
  {
    stdio: "inherit",
    // The build is a production build; running it in development mode mixes
    // React's two builds ("dispatcher.getOwner is not a function").
    env: { ...process.env, NODE_ENV: process.env.NODE_ENV ?? "production" },
  },
);
child.on("exit", (code) => process.exit(code ?? 0));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

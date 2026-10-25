// Read-only smoke check. The signed cookie stays in memory and is never logged.
import { writeFile } from "node:fs/promises";
import { adminLogin } from "../app/domain/admin-auth.server";
const cookie = await adminLogin(process.env.ADMIN_PASSWORD ?? "");
if (!cookie) throw new Error("Local admin configuration is unavailable");
const response = await fetch("https://thereserve.watch/admin/catalogue", {
  headers: { cookie: cookie.split(";")[0]! },
  signal: AbortSignal.timeout(25000),
});
const text = await response.text();
const evidence = {
  at: new Date().toISOString(),
  status: response.status,
  entireCatalogue: text.includes("Entire catalogue:"),
  masterTotal: text.includes("44,880"),
  recommendationPoolLabel: text.includes("Recommendation pool:"),
  unpricedLabel: text.includes("awaiting a verified price"),
};
await writeFile(
  "docs/reports/admin-catalogue-production.json",
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(JSON.stringify(evidence, null, 2));
if (
  response.status !== 200 ||
  !evidence.entireCatalogue ||
  !evidence.masterTotal
)
  throw new Error("Production master catalogue smoke did not pass");

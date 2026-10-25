// Read-only smoke check. The signed cookie stays in memory and is never logged.
import { writeFile } from "node:fs/promises";
import { adminLogin } from "../app/domain/admin-auth.server";
import { catalogueClient, rpc } from "../app/domain/watch-catalogue.server";
import { z } from "zod";
const client = catalogueClient();
if (!client) throw new Error("Catalogue read configuration required");
const live = z
  .object({ counts: z.object({ all: z.number() }) })
  .parse(
    await rpc(
      client,
      "watch_catalogue_admin_page_v1",
      { p_filter: "all", p_query: "", p_page: 1 },
      15000,
    ),
  );
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
  masterTotal: text.includes(live.counts.all.toLocaleString("en-US")),
  expectedTotal: live.counts.all,
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

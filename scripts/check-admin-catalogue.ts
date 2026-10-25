import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { catalogueClient, rpc } from "../app/domain/watch-catalogue.server";
import { catalogueWatchSchema } from "../app/domain/watch-catalogue";
const client = catalogueClient();
if (!client) throw new Error("Catalogue read configuration required");
const schema = z.object({
  counts: z.record(z.string(), z.number()),
  rows: z.array(catalogueWatchSchema),
  page: z.number(),
  pages: z.number(),
  filteredTotal: z.number(),
});
const load = async (filter: string, query: string, page: number) =>
  schema.parse(
    await rpc(
      client,
      "watch_catalogue_admin_page_v1",
      { p_filter: filter, p_query: query, p_page: page },
      15000,
    ),
  );
const first = await load("all", "", 1),
  second = await load("all", "", 2),
  searched = await load("all", "T006.407.11.033.03", 1),
  last = await load("all", "", 100000);
if (
  (first.counts.all ?? 0) < 40000 ||
  first.rows.length !== 60 ||
  second.rows.length !== 60
)
  throw new Error("Incomplete master catalogue pagination");
if (second.rows.some((row) => first.rows.some((other) => other.id === row.id)))
  throw new Error("Pages overlap");
if (last.page !== last.pages || searched.rows.length === 0)
  throw new Error("Search or page clamping failed");
const result = {
  at: new Date().toISOString(),
  counts: first.counts,
  firstPageRows: first.rows.length,
  secondPageRows: second.rows.length,
  pages: first.pages,
  lastPage: last.page,
  lastPageRows: last.rows.length,
  searchHits: searched.filteredTotal,
  scope:
    "Authenticated admin pagination covers master catalogue; recommendation filters unchanged.",
};
await writeFile(
  "docs/reports/admin-catalogue-pagination.json",
  `${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));

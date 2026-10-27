// Refresh the facts carried by the checked-in archetype-result cache from the
// local catalogue. It deliberately retains the existing editorial selection
// and rationale: creating a new selection requires Muse and is a separate,
// paid operation.
import { readFile, writeFile } from "node:fs/promises";

import { catalogueClient, rpc } from "../app/domain/watch-catalogue.server";
import {
  catalogueWatchSchema,
  type CatalogueWatch,
} from "../app/domain/watch-catalogue";
import { z } from "zod";
import type {
  ArchetypePick,
  ArchetypePicks,
} from "../app/domain/archetype-picks";

const client = catalogueClient();
if (!client) throw new Error("Catalogue read configuration required");

const sourceFile = "app/data/archetype-picks.json";
const picks = JSON.parse(await readFile(sourceFile, "utf8")) as ArchetypePicks;
const pickKeys = Object.values(picks.lists).flatMap((bands) =>
  Object.values(bands).flatMap((list) =>
    list.flatMap((pick) =>
      pick.referenceCode
        ? [{ brand: pick.brand, referenceCode: pick.referenceCode }]
        : [],
    ),
  ),
);
const catalogue: CatalogueWatch[] = [];
for (let start = 0; start < pickKeys.length; start += 100) {
  catalogue.push(
    ...z
      .array(catalogueWatchSchema)
      .parse(
        await rpc(
          client,
          "watch_catalogue_lookup_v1",
          { p_keys: pickKeys.slice(start, start + 100) },
          30_000,
        ),
      ),
  );
}

function normalized(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchingWatch(pick: ArchetypePick): CatalogueWatch | null {
  const byId = catalogue.find((watch) => watch.id === pick.id);
  if (byId) return byId;
  const matches = catalogue.filter(
    (watch) =>
      normalized(watch.brand) === normalized(pick.brand) &&
      normalized(watch.referenceCode) === normalized(pick.referenceCode),
  );
  return matches.length === 1 ? matches[0]! : null;
}

function refreshedPick(
  pick: ArchetypePick,
  watch: CatalogueWatch,
): ArchetypePick {
  return {
    ...pick,
    id: watch.id,
    brand: watch.brand,
    model: watch.model,
    referenceCode: watch.referenceCode,
    referenceConfirmed: watch.referenceConfirmed,
    sourceKind: watch.sourceKind,
    imageUrl: watch.imageUrl,
    price:
      watch.priceAmount !== null && watch.priceCurrency
        ? { amount: watch.priceAmount, currency: watch.priceCurrency }
        : null,
    caseDiameterMm: watch.caseDiameterMm,
    waterResistanceM: watch.waterResistanceM,
    movement: watch.movement,
  };
}

let refreshed = 0;
let unchanged = 0;
let unmatched = 0;
for (const bands of Object.values(picks.lists)) {
  for (const list of Object.values(bands)) {
    for (let index = 0; index < list.length; index += 1) {
      const oldPick = list[index]!;
      const watch = matchingWatch(oldPick);
      if (!watch) {
        unmatched += 1;
        continue;
      }
      const nextPick = refreshedPick(oldPick, watch);
      if (JSON.stringify(oldPick) === JSON.stringify(nextPick)) unchanged += 1;
      else refreshed += 1;
      list[index] = nextPick;
    }
  }
}

picks.generatedAt = new Date().toISOString();
await writeFile(sourceFile, `${JSON.stringify(picks, null, 1)}\n`);
const report = {
  at: picks.generatedAt,
  cachedPicks: refreshed + unchanged + unmatched,
  refreshed,
  unchanged,
  unmatched,
  policy:
    "Facts came only from the local catalogue. Existing editorial picks and rationales were retained; this command makes no AI or web requests.",
};
await writeFile(
  "docs/reports/archetype-picks-refresh.json",
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report));

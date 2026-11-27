// Before and after on the same watches: the cards of a rating sheet with
// each watch's facts as the catalogue holds them now, so the judge can read
// exactly the watches it read before the catalogue repair (2026-11-27).
// Film cards are left out (the repair did not touch them). A card whose
// watch would no longer be shown (its price parked until it is checked
// again, or the watch rejected) is listed as withdrawn, not judged.
//
//   node --env-file=.env --import tsx scripts/refresh-sheet-facts.ts \
//     --sheet docs/reports/rating-sheet-2026-11-26.json --label refreshed
//
// Writes docs/reports/rating-sheet-<label>-<date>.json. Read-only.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { secondaryMarketPrice } from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
} from "../app/domain/watch-catalogue.server";
import { fold } from "./eval-sets";

function option(name: string) {
  const at = process.argv.indexOf(`--${name}`);
  return at > 0 ? process.argv[at + 1] : undefined;
}
const sheetPath = option("sheet");
const label = option("label") ?? "refreshed";
if (!sheetPath) throw new Error("--sheet <rating sheet json> is required.");
if (!/^[a-z0-9-]{1,40}$/.test(label))
  throw new Error("--label takes lowercase letters, digits and dashes.");
const client = catalogueClient();
if (!client) throw new Error("SUPABASE_URL and the service key are required.");

type Card = {
  id: string;
  tool: string;
  brand: string;
  model: string;
  referenceCode: string | null;
  section?: string;
  [key: string]: unknown;
};
const sheet = JSON.parse(readFileSync(sheetPath, "utf8")) as {
  id: string;
  cards: Card[];
  [key: string]: unknown;
};
const catalogue = await listCatalogue(client, true);
const byKey = new Map(
  catalogue
    .filter((watch) => watch.referenceCode)
    .map((watch) => [
      `${fold(watch.brand)}|${fold(watch.referenceCode!)}`,
      watch,
    ]),
);

const cards: Card[] = [];
const withdrawn: { card: string; reason: string }[] = [];
const unmatched: string[] = [];
for (const card of sheet.cards) {
  if (card.tool === "film") continue;
  const watch = card.referenceCode
    ? byKey.get(`${fold(card.brand)}|${fold(card.referenceCode)}`)
    : undefined;
  if (!watch) {
    unmatched.push(card.id);
    continue;
  }
  if (
    watch.reviewStatus === "rejected" ||
    watch.priceStatus === "unconfirmed"
  ) {
    withdrawn.push({
      card: card.id,
      reason:
        watch.reviewStatus === "rejected"
          ? "rejected"
          : "price parked until it is checked again",
    });
    continue;
  }
  const known = watch.priceAmount !== null && watch.priceCurrency !== null;
  cards.push({
    ...card,
    model: watch.model,
    referenceCode: watch.referenceCode,
    price: known
      ? { amount: watch.priceAmount, currency: watch.priceCurrency }
      : null,
    priceCondition: known && secondaryMarketPrice(watch) ? "pre-owned" : "new",
    priceConfirmed: watch.priceStatus === "confirmed",
    caseDiameterMm: watch.caseDiameterMm,
    movement: watch.movement,
    waterResistanceM: watch.waterResistanceM,
    verified: watch.referenceConfirmed,
    section: watch.referenceConfirmed ? (card.section ?? "main") : "alsoWorth",
    sourceUrl: watch.sourceUrl,
  });
}
const output = {
  ...sheet,
  id: `${sheet.id}-${label}`,
  refreshedAt: new Date().toISOString(),
  from: sheetPath,
  withdrawn,
  unmatched,
  cards,
};
const path = resolve(
  `docs/reports/rating-sheet-${label}-${output.refreshedAt.slice(0, 10)}.json`,
);
writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`);
console.log(
  `${cards.length} cards with today's facts, ${withdrawn.length} withdrawn, ${unmatched.length} not in the catalogue → ${path}`,
);
process.exit(0);

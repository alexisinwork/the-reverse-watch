// Builds the "10 watches for your archetype" lists shown after the archetype
// quiz: 6 archetypes x 3 price bands (the quiz's price idea), 10 watches
// each, chosen by Muse Spark from approved catalogue watches with a photo
// and a price. Writes app/data/archetype-picks.json, which ships with the
// site, so every visitor sees the same list instantly.
//
// --top-up first searches the $10k-$50k ranges (the catalogue was built up
// to $10k) and adds what it finds to the catalogue, approving watches with
// a price (owner rule).
//   node --env-file=.env --import tsx scripts/build-archetype-picks.ts [--top-up]
import { writeFileSync } from "node:fs";

import {
  defaultDeps,
  museJson,
  type Deps,
} from "../app/domain/ai-providers.server";
import {
  candidateIdentity,
  proposedUsd,
  proposeForCell,
  readBuildCandidate,
  verifyCandidate,
} from "../app/domain/catalogue-build.server";
import {
  ARCHETYPES,
  ARCHETYPE_IDS,
  PRICE_COMFORTS,
  type ArchetypeId,
} from "../app/domain/discovery-archetype";
import { loadFxTable } from "../app/domain/fx.server";
import { lookupMarketPrice } from "../app/domain/market-price.server";
import { findPriceRange } from "../app/domain/questionnaire-v4";
import {
  CATALOGUE_STYLES,
  priceIn,
  type CatalogueStyle,
  type CatalogueWatch,
} from "../app/domain/watch-catalogue";
import {
  catalogueClient,
  listCatalogue,
  recordCataloguePrice,
  reviewCatalogueWatch,
  upsertCatalogueWatch,
} from "../app/domain/watch-catalogue.server";
import {
  ARCHETYPE_BANDS,
  type ArchetypePicks,
  type PriceComfort,
} from "../app/domain/archetype-picks";

const client = catalogueClient();
const baseDeps = defaultDeps();
if (!client || !baseDeps.config.museSpark) {
  throw new Error("Supabase service key and MUSE_SPARK_API_KEY are required.");
}
// Choosing and proposing well matters more than speed: the full model.
const deps: Deps = {
  ...baseDeps,
  config: {
    ...baseDeps.config,
    museSpark: {
      ...baseDeps.config.museSpark,
      fastModel:
        process.env.MUSE_SPARK_MODEL?.trim() ||
        baseDeps.config.museSpark.fastModel,
    },
  },
};
const fx = await loadFxTable();

// ---------------------------------------------------------------------------
// Optional top-up above $10k

if (process.argv.includes("--top-up")) {
  const ranges = [
    "10000_15000",
    "15000_20000",
    "20000_25000",
    "30000_35000",
    "45000_50000",
  ];
  const known = new Set(
    (await listCatalogue(client, true)).map((w) => w.identityKey),
  );
  let added = 0;
  const cells = ranges.flatMap((id) =>
    CATALOGUE_STYLES.map((style) => ({
      range: findPriceRange(id)!,
      style,
      run: 8,
    })),
  );
  const queue = [...cells];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let cell = queue.shift(); cell; cell = queue.shift()) {
        const proposals = await proposeForCell(cell, [], deps).catch(() => []);
        for (const raw of proposals) {
          const candidate = readBuildCandidate(raw);
          if (!candidate) continue;
          const identity = candidateIdentity(candidate);
          if (known.has(identity)) continue;
          known.add(identity);
          try {
            const entry = await verifyCandidate(
              candidate,
              [cell.style],
              { range: cell.range.id, style: cell.style, archetypeTopUp: true },
              deps,
              fx,
            );
            const id = await upsertCatalogueWatch(client, entry);
            let priced = entry.priceStatus === "confirmed";
            if (!priced) {
              const market = await lookupMarketPrice(
                candidate,
                deps,
                fx,
                proposedUsd({ priceEvidence: entry.priceEvidence ?? {} }, fx),
              );
              if (market.status === "found") {
                await recordCataloguePrice(client, id, {
                  kind: "approximate",
                  amount: market.amount,
                  currency: market.currency,
                  evidence: market.evidence,
                });
                priced = true;
              }
            }
            if (priced) await reviewCatalogueWatch(client, id, "approved");
            added += 1;
            console.log(
              `added ${candidate.brand} ${candidate.model} (${cell.range.id}, ${cell.style})${priced ? "" : " - no price"}`,
            );
          } catch (error) {
            console.error(
              `  ${candidate.brand} ${candidate.model}: ${error instanceof Error ? error.message.slice(0, 100) : "error"}`,
            );
          }
        }
      }
    }),
  );
  console.log(`Top-up added ${added} watches.`);
}

// ---------------------------------------------------------------------------
// Choosing ten per archetype and band

const ARCHETYPE_STYLES: Record<ArchetypeId, CatalogueStyle[]> = {
  field_rationalist: ["field", "dive", "sport", "travel"],
  quiet_custodian: ["dress", "everyday"],
  architectural_modernist: ["dress", "everyday", "sport"],
  expressive_collector: [...CATALOGUE_STYLES],
  mechanical_connoisseur: ["dress", "everyday", "travel"],
  recognised_standard_bearer: [...CATALOGUE_STYLES],
};

const PICK_SYSTEM = [
  "You are the senior editor of The Reserve, a watch publication.",
  "You receive a collector archetype and a numbered list of current-production watches from our catalogue, with their facts.",
  "Choose the 10 watches that best suit the archetype. Prefer a varied list: at most 2 watches from one brand, a mix of styles and sizes.",
  "For each, write one plain-English sentence (why) on why it suits this archetype, using only the facts given.",
  'Respond only with JSON: {"picks":[{"index","why"}]}',
].join(" ");

const catalogue = (await listCatalogue(client)).filter(
  (watch) => watch.reviewStatus === "approved" && watch.imageUrl,
);

function inBand(watch: CatalogueWatch, band: PriceComfort) {
  const usd = priceIn(watch, "USD", fx);
  if (usd === null) return false;
  const { minimumUsd, maximumUsd } = ARCHETYPE_BANDS[band];
  return usd >= minimumUsd && (maximumUsd === null || usd < maximumUsd);
}

function describe(watch: CatalogueWatch, index: number) {
  const usd = Math.round(priceIn(watch, "USD", fx)!);
  return [
    `${index}. ${watch.brand} ${watch.model}${watch.referenceCode ? ` (${watch.referenceCode})` : ""}`,
    `USD ${usd}`,
    watch.caseDiameterMm ? `${watch.caseDiameterMm} mm` : null,
    watch.movement,
    watch.inHouseCalibre ? "in-house calibre" : null,
    watch.waterResistanceM ? `${watch.waterResistanceM} m` : null,
    watch.styles.join("/"),
    watch.caseMaterial,
  ]
    .filter(Boolean)
    .join(", ");
}

const picks: ArchetypePicks = {
  generatedAt: new Date().toISOString(),
  lists: {} as ArchetypePicks["lists"],
};

for (const archetypeId of ARCHETYPE_IDS) {
  const archetype = ARCHETYPES[archetypeId];
  picks.lists[archetypeId] = {} as ArchetypePicks["lists"][ArchetypeId];
  for (const band of PRICE_COMFORTS) {
    const pool = catalogue
      .filter(
        (watch) =>
          inBand(watch, band) &&
          watch.styles.some((style) =>
            ARCHETYPE_STYLES[archetypeId].includes(style),
          ),
      )
      // Best-documented first, then a brand-spread sample of at most 90.
      .sort(
        (a, b) =>
          Number(b.referenceConfirmed) - Number(a.referenceConfirmed) ||
          Number(b.priceStatus === "confirmed") -
            Number(a.priceStatus === "confirmed") ||
          a.brand.localeCompare(b.brand),
      );
    const perBrand = new Map<string, number>();
    const shortlist = pool
      .filter((watch) => {
        const count = perBrand.get(watch.brand) ?? 0;
        perBrand.set(watch.brand, count + 1);
        return count < 4;
      })
      .slice(0, 90);
    const payload = (await museJson(
      PICK_SYSTEM,
      [
        `Archetype: ${archetype.title}. ${archetype.strapline} ${archetype.description}`,
        `Price band: ${ARCHETYPE_BANDS[band].label}.`,
        "Watches:",
        ...shortlist.map(describe),
      ].join("\n"),
      "reserve-archetype-picks-v1",
      deps,
      120_000,
      12_000,
    ).catch(() => ({ picks: [] }))) as {
      picks?: { index?: unknown; why?: unknown }[];
    };
    const chosen = (payload.picks ?? [])
      .filter((pick) => typeof pick.index === "number" && shortlist[pick.index])
      .slice(0, 10)
      .map((pick) => {
        const watch = shortlist[pick.index as number]!;
        return {
          id: watch.id,
          brand: watch.brand,
          model: watch.model,
          referenceCode: watch.referenceCode,
          imageUrl: watch.imageUrl,
          price:
            watch.priceAmount !== null && watch.priceCurrency
              ? { amount: watch.priceAmount, currency: watch.priceCurrency }
              : null,
          caseDiameterMm: watch.caseDiameterMm,
          waterResistanceM: watch.waterResistanceM,
          movement: watch.movement,
          why: typeof pick.why === "string" ? pick.why.trim() : "",
        };
      });
    picks.lists[archetypeId][band] = chosen;
    console.log(
      `${archetype.title} / ${band}: ${chosen.length} of ${shortlist.length} candidates`,
    );
  }
}

writeFileSync(
  "app/data/archetype-picks.json",
  `${JSON.stringify(picks, null, 1)}\n`,
);
console.log("Wrote app/data/archetype-picks.json");

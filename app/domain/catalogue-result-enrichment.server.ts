import type { AiSearchView, FoundWatch } from "./ai-watch-types";
import type { CatalogueWatch } from "./watch-catalogue";
import {
  catalogueClient,
  rpc,
  type CatalogueClient,
} from "./watch-catalogue.server";
import { catalogueWatchSchema } from "./watch-catalogue";
import { z } from "zod";

export async function storyCatalogueWatch(attribution: {
  brand: string | null;
  model: string | null;
  reference: string | null;
}) {
  if (!attribution.brand || !attribution.reference) return null;
  const [watch] = await enrichResultWatches([
    {
      brand: attribution.brand,
      model: attribution.model ?? attribution.reference,
      referenceCode: attribution.reference,
      sourceUrl: "",
      imageUrl: null,
      priceNote: null,
      rationale:
        "Reference specifications; the product photo does not establish who wore it.",
      details: {},
    },
  ]);
  return watch?.details.catalogueId ? watch : null;
}

const keyPart = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");
const key = (watch: { brand: string; referenceCode: string | null }) =>
  watch.referenceCode
    ? `${keyPart(watch.brand)}|${keyPart(watch.referenceCode)}`
    : null;

/** Exact identity only; film/person attribution is never inferred from a product catalogue. */
export function mergeCatalogueFacts(
  watches: FoundWatch[],
  catalogue: CatalogueWatch[],
  options: { preferCatalogueTitle?: boolean } = {},
) {
  const byKey = new Map<string, CatalogueWatch[]>();
  for (const row of catalogue) {
    const identity = key(row);
    if (!identity || row.reviewStatus === "rejected") continue;
    byKey.set(identity, [...(byKey.get(identity) ?? []), row]);
  }
  return watches.map((watch) => {
    const matches = byKey.get(key(watch) ?? "") ?? [];
    if (matches.length !== 1) return watch;
    const row = matches[0]!;
    if (!row.referenceConfirmed)
      return row.priceEvidence.referenceRecheck ===
        "exact_variant_not_confirmed"
        ? { ...watch, details: { ...watch.details, referenceVerified: false } }
        : watch;
    const useCataloguePrice =
      watch.details.priceCondition !== "pre-owned" &&
      (row.priceStatus === "confirmed" ||
        (row.priceStatus === "approximate" && !watch.details.price)) &&
      row.priceAmount !== null &&
      !!row.priceCurrency;
    const price =
      useCataloguePrice && row.priceAmount !== null && row.priceCurrency
        ? { amount: row.priceAmount, currency: row.priceCurrency }
        : watch.details.price;
    const evidence = row.foundIn.filter(
      (item): item is { source: string; url?: string } =>
        !!item &&
        typeof item === "object" &&
        "source" in item &&
        typeof (item as { source?: unknown }).source === "string",
    );
    const catalogueEvidence =
      evidence.find((item) => item.source === "dials") ??
      evidence.find((item) => item.source === "spacecity");
    const dialsEvidence = evidence.find((item) => item.source === "dials");
    const useDialsTitle =
      options.preferCatalogueTitle ||
      (!!dialsEvidence && row.sourceKind === "catalogue");
    const referenceSourceLabel = catalogueEvidence
      ? catalogueEvidence.source === "dials"
        ? "Dials"
        : "Space City Timepieces"
      : watch.details.referenceSourceLabel;
    const referenceSourceUrl =
      (catalogueEvidence?.url && /^https:\/\//i.test(catalogueEvidence.url)
        ? catalogueEvidence.url
        : undefined) ?? watch.details.referenceSourceUrl;
    const dialsDetails = row.sourceDetails?.dials;
    return {
      ...watch,
      ...(useDialsTitle && row.model !== watch.model
        ? { model: row.model }
        : {}),
      imageUrl: watch.imageUrl ?? row.imageUrl,
      priceNote:
        price && price !== watch.details.price
          ? `${price.currency} ${Math.round(price.amount).toLocaleString("en")}`
          : watch.priceNote,
      details: {
        ...watch.details,
        price,
        caseDiameterMm: watch.details.caseDiameterMm ?? row.caseDiameterMm,
        waterResistanceM:
          watch.details.waterResistanceM ?? row.waterResistanceM,
        movement: watch.details.movement ?? row.movement,
        materials: {
          case: watch.details.materials?.case ?? row.caseMaterial,
          caseback: watch.details.materials?.caseback ?? row.casebackMaterial,
          strap: watch.details.materials?.strap ?? row.strapMaterial,
        },
        referenceVerified: true,
        ...(row.sourceKind ? { sourceKind: row.sourceKind } : {}),
        ...(referenceSourceLabel ? { referenceSourceLabel } : {}),
        ...(referenceSourceUrl ? { referenceSourceUrl } : {}),
        ...(dialsDetails && typeof dialsDetails === "object"
          ? { sourceDetails: dialsDetails }
          : {}),
        ...(useDialsTitle && row.model !== watch.model
          ? { previousModelTitle: watch.model }
          : {}),
        catalogueId: row.id,
        catalogueUpdatedAt: row.updatedAt,
        ...(price !== watch.details.price
          ? { priceConfirmed: row.priceStatus === "confirmed" }
          : {}),
      },
    };
  });
}

export async function enrichResultWatches(
  watches: FoundWatch[],
  client: CatalogueClient | null = catalogueClient(),
  options: { preferCatalogueTitle?: boolean } = {},
): Promise<FoundWatch[]> {
  if (!client || !watches.some((w) => w.referenceCode)) return watches;
  try {
    const keys = watches
      .filter((w) => w.referenceCode)
      .map((w) => ({ brand: w.brand, referenceCode: w.referenceCode }));
    const catalogue = z
      .array(catalogueWatchSchema)
      .parse(
        await rpc(
          client,
          "watch_catalogue_lookup_v1",
          { p_keys: keys.slice(0, 100) },
          6_000,
        ),
      );
    return mergeCatalogueFacts(watches, catalogue, options);
  } catch {
    return watches;
  }
}

export async function enrichSearchView(
  view: AiSearchView,
): Promise<AiSearchView> {
  if (view.status !== "found") return view;
  const all = [...view.watches, ...(view.alsoWorth ?? [])];
  const enriched = await enrichResultWatches(all);
  return {
    ...view,
    watches: enriched.slice(0, view.watches.length),
    ...(view.alsoWorth
      ? { alsoWorth: enriched.slice(view.watches.length) }
      : {}),
  };
}

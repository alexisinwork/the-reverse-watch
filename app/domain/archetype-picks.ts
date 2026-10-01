/**
 * The ten watches shown after the archetype quiz, per archetype and per the
 * quiz's price idea. Chosen from the catalogue by scripts/build-archetype-
 * picks.ts and stored in app/data/archetype-picks.json.
 */
import type { FoundWatch } from "./ai-watch-types";
import type { ArchetypeId, PRICE_COMFORTS } from "./discovery-archetype";
import picksFile from "../data/archetype-picks.json";

export type PriceComfort = (typeof PRICE_COMFORTS)[number];

export const ARCHETYPE_BANDS: Record<
  PriceComfort,
  { minimumUsd: number; maximumUsd: number | null; label: string }
> = {
  // A first serious watch starts at about USD 2,000 (owner decision,
  // 2026-09-30); the option labels in discovery-archetype.ts match.
  first_good_watch: {
    minimumUsd: 0,
    maximumUsd: 2_000,
    label: "a first good watch, under USD 2,000",
  },
  considered_entry: {
    minimumUsd: 2_000,
    maximumUsd: 5_000,
    label: "a considered first serious watch, about USD 2,000 to 5,000",
  },
  established_collection: {
    minimumUsd: 5_000,
    maximumUsd: 10_000,
    label: "an established collection purchase, about USD 5,000 to 10,000",
  },
  exceptional_object: {
    minimumUsd: 10_000,
    maximumUsd: null,
    label: "an exceptional object, USD 10,000 and above",
  },
};

export type ArchetypePick = {
  id: string;
  brand: string;
  model: string;
  referenceCode: string | null;
  /** A maker's or authorised retailer's page shows this reference. */
  referenceConfirmed?: boolean;
  /** Whether that page is the maker's own or an authorised retailer's. */
  sourceKind?: "manufacturer" | "retailer" | null;
  imageUrl: string | null;
  price: { amount: number; currency: string } | null;
  caseDiameterMm: number | null;
  waterResistanceM: number | null;
  movement: string | null;
  why: string;
};

export type ArchetypePicks = {
  generatedAt: string;
  lists: Record<ArchetypeId, Record<PriceComfort, ArchetypePick[]>>;
};

const picks = picksFile as unknown as Partial<ArchetypePicks>;

/** The picks as watch cards, or an empty list before the file is built. */
export function archetypeWatches(
  archetypeId: ArchetypeId,
  band: PriceComfort,
): FoundWatch[] {
  return (picks.lists?.[archetypeId]?.[band] ?? []).map((pick) => ({
    brand: pick.brand,
    model: pick.model,
    referenceCode: pick.referenceCode,
    // Source links are never shown to visitors (owner decision).
    sourceUrl: "",
    imageUrl: pick.imageUrl,
    priceNote: null,
    rationale: pick.why,
    details: {
      price: pick.price,
      referenceVerified: pick.referenceConfirmed === true,
      ...(pick.sourceKind ? { sourceKind: pick.sourceKind } : {}),
      caseDiameterMm: pick.caseDiameterMm,
      waterResistanceM: pick.waterResistanceM,
      movement: pick.movement,
    },
  }));
}

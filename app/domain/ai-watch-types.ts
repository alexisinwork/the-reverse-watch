export type SourceKind = "manufacturer" | "retailer";

export type WatchDetails = {
  price?: { amount: number; currency: string } | null;
  waterResistanceM?: number | null;
  caseDiameterMm?: number | null;
  movement?: string | null;
  materials?: { case: string | null; caseback: string | null; strap: string | null };
  sourceKind?: SourceKind;
  referenceVerified?: boolean;
  person?: string | null;
  work?: string | null;
  year?: number | null;
  context?: string | null;
  evidenceUrl?: string | null;
};

export type FoundWatch = {
  brand: string;
  model: string;
  referenceCode: string | null;
  sourceUrl: string;
  imageUrl: string | null;
  priceNote: string | null;
  rationale: string;
  details: WatchDetails;
};

/** What the browser receives: no internal error text, no upstream bodies. */
export type AiSearchOutcome =
  | { status: "found"; watches: FoundWatch[]; summary: string }
  | { status: "no_match"; summary: string }
  | { status: "unavailable" };

export type AiSearchView =
  | (Extract<AiSearchOutcome, { status: "found" }> & { fromCache: boolean })
  | Exclude<AiSearchOutcome, { status: "found" }>;

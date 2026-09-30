export type SourceKind = "manufacturer" | "retailer";

export type WatchDetails = {
  price?: { amount: number; currency: string } | null;
  waterResistanceM?: number | null;
  caseDiameterMm?: number | null;
  movement?: string | null;
  materials?: {
    case: string | null;
    caseback: string | null;
    strap: string | null;
  };
  sourceKind?: SourceKind;
  referenceVerified?: boolean;
  person?: string | null;
  work?: string | null;
  year?: number | null;
  context?: string | null;
  evidenceUrl?: string | null;
  /** Catalogue watches only: pending ones are public but marked unreviewed. */
  reviewStatus?: "pending" | "approved" | "rejected";
  /** Price confirmed by two independent lookups (or by the reviewer). */
  priceConfirmed?: boolean;
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
  | (Extract<AiSearchOutcome, { status: "found" }> & {
      fromCache: boolean;
      /** Where the shortlist came from; absent for film searches. */
      origin?: "catalogue" | "live" | "mixed";
      /** Fits every answer, but no maker's page confirmed the reference. */
      alsoWorth?: FoundWatch[];
    })
  | Exclude<AiSearchOutcome, { status: "found" }>;

/** One step of a running search, shown to the visitor as it happens. */
export type ProgressEvent = {
  text: string;
  /** Set when this step confirmed a watch: shown before the search ends. */
  watch?: FoundWatch;
};

/**
 * A chain of promises the server resolves one event at a time; React
 * Router streams each link to the browser as soon as it resolves.
 */
export type ProgressLink = {
  event: ProgressEvent;
  next: Promise<ProgressLink | null>;
};

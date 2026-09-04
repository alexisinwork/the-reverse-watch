import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import {
  seedCatalogueSchema,
  type EvidenceField,
  type SeedCatalogue,
  type SeedReferenceVariant,
} from "../app/domain/catalogue";
import {
  M1_REVIEW_FIELDS,
  ownerReferenceIntakeSchema,
  researchManifestSchema,
  researchReviewSchema,
  researchWorkbookIntakeSchema,
} from "../app/domain/research";
import type { ResearchReview } from "../app/domain/research";

const ROOT = process.cwd();
const PROMOTED_AT = "2026-08-31T20:00:00.000Z";
const STALE_AFTER = "2027-08-31T20:00:00.000Z";

type ProposedFact = {
  fieldName: string;
  value: unknown;
  sourceUrl: string;
  sourceType: string;
  evidenceKind: "observed" | "estimated_class" | "missing";
  observedAt: string;
  retrievedAt: string;
};

type NormalizedResearch = {
  targetId: string;
  candidateIdentity: {
    brand: string;
    model: string;
    referenceCode: string;
    variantName: string;
  };
  facts: ProposedFact[];
};

type OverrideSource = {
  url: string;
  title: string;
  publisher: string;
  sourceType?: "manufacturer_product" | "secondary_editorial";
};

type PriceOverride = OverrideSource & {
  amountMinor: number;
  currency: "USD" | "EUR";
  marketCountry: string;
  channel: "authorized_dealer" | "secondary_market";
  condition: "new" | "certified_pre_owned" | "pre_owned";
  availability: "in_stock" | "waitlist_or_allocation" | "unavailable";
};

const PRICE_OVERRIDES: Record<string, PriceOverride> = {
  "124300": {
    amountMinor: 919_600,
    currency: "USD",
    marketCountry: "US",
    channel: "secondary_market",
    condition: "pre_owned",
    availability: "in_stock",
    url: "https://watchcharts.com/watches/brand/rolex/oyster%2520perpetual?page=2",
    title: "Rolex Oyster Perpetual 41 124300 August 2026 market price",
    publisher: "WatchCharts",
  },
  "126900": {
    amountMinor: 1_000_000,
    currency: "USD",
    marketCountry: "US",
    channel: "secondary_market",
    condition: "pre_owned",
    availability: "in_stock",
    url: "https://www.chrono24.com/rolex/air-king--mod5.htm",
    title: "Rolex Air-King 126900 market price",
    publisher: "Chrono24",
  },
  "50519-0006": {
    amountMinor: 1_405_000,
    currency: "USD",
    marketCountry: "US",
    channel: "secondary_market",
    condition: "pre_owned",
    availability: "in_stock",
    url: "https://everywatch.com/rolex?modelSlug=cellini&pageNumber=2&refSlug=50519",
    title: "Rolex Cellini 50519-0006 market listings",
    publisher: "EveryWatch",
  },
  "50525-0015": {
    amountMinor: 1_890_000,
    currency: "EUR",
    marketCountry: "DE",
    channel: "authorized_dealer",
    condition: "new",
    availability: "unavailable",
    url: "https://prestigecalibers.com/en-en/collections/rolex/products/rolex-cellini-dual-time-mens-watch-50525-0015",
    title: "Rolex Cellini Dual Time 50525-0015 retail record",
    publisher: "Prestige Calibers",
  },
  "50535-0002": {
    amountMinor: 2_675_000,
    currency: "USD",
    marketCountry: "US",
    channel: "authorized_dealer",
    condition: "new",
    availability: "unavailable",
    url: "https://content.rolex.com/dam/media/brochures/cellini/m50535-0002.pdf",
    title: "Rolex Cellini Moonphase 50535-0002",
    publisher: "Rolex",
    sourceType: "manufacturer_product",
  },
  "50505": {
    amountMinor: 2_132_900,
    currency: "USD",
    marketCountry: "US",
    channel: "secondary_market",
    condition: "pre_owned",
    availability: "in_stock",
    url: "https://newsroom-content.rolex.com/-/media/project/rolex/newsroom/rolex/rolex-newsroom-int/brochures/en/02_rolex_cellini_time_english_2020.pdf",
    title: "Rolex Cellini Time 50505 research record",
    publisher: "Rolex",
    sourceType: "manufacturer_product",
  },
  "50509": {
    amountMinor: 1_299_500,
    currency: "USD",
    marketCountry: "US",
    channel: "secondary_market",
    condition: "pre_owned",
    availability: "in_stock",
    url: "https://www.chrono24.com/rolex/ref-50509.htm",
    title: "Rolex Cellini Time 50509 current market listing",
    publisher: "Chrono24",
  },
  "50529": {
    amountMinor: 1_680_000,
    currency: "USD",
    marketCountry: "US",
    channel: "secondary_market",
    condition: "pre_owned",
    availability: "in_stock",
    url: "https://www.exquisitetimepieces.com/products/rolex-50529-cellini-dual-time-black-dial-210009n43253",
    title: "Rolex Cellini Dual Time 50529 current market listing",
    publisher: "Exquisite Timepieces",
  },
  "126500LN-0002": {
    amountMinor: 1_690_000,
    currency: "USD",
    marketCountry: "US",
    channel: "authorized_dealer",
    condition: "new",
    availability: "waitlist_or_allocation",
    url: "https://www.rolex.com/en-us/watches/find-rolex/steel",
    title: "Rolex Oystersteel catalogue prices",
    publisher: "Rolex",
    sourceType: "manufacturer_product",
  },
  "126710BLRO": {
    amountMinor: 2_231_800,
    currency: "USD",
    marketCountry: "US",
    channel: "secondary_market",
    condition: "pre_owned",
    availability: "in_stock",
    url: "https://pricethat.watch/watches/rolex/126710blro",
    title: "Rolex GMT-Master II 126710BLRO market price",
    publisher: "Price That Watch",
  },
  "116400GV-0002": {
    amountMinor: 1_550_000,
    currency: "USD",
    marketCountry: "US",
    channel: "secondary_market",
    condition: "certified_pre_owned",
    availability: "unavailable",
    url: "https://www.tourneau.com/watches/rolex-certified-pre-owned/milgauss-116400gv-0002-VRX9737082.html",
    title: "Rolex Certified Pre-Owned Milgauss 116400GV-0002",
    publisher: "Tourneau",
  },
  "277200": {
    amountMinor: 630_000,
    currency: "USD",
    marketCountry: "US",
    channel: "authorized_dealer",
    condition: "new",
    availability: "waitlist_or_allocation",
    url: "https://www.rolex.com/en-us/watches/oyster-perpetual/m277200-0017",
    title: "Rolex Oyster Perpetual 31 277200",
    publisher: "Rolex",
    sourceType: "manufacturer_product",
  },
  "80319-0040": {
    amountMinor: 1_650_000,
    currency: "EUR",
    marketCountry: "ES",
    channel: "secondary_market",
    condition: "certified_pre_owned",
    availability: "in_stock",
    url: "https://www.perodri.es/en/rolex-cpo/pearlmaster-rolex-cpo/pearlmaster-29/",
    title: "Rolex Certified Pre-Owned Pearlmaster M80319-0040",
    publisher: "Perodri Joyeros",
  },
  "86409": {
    amountMinor: 18_600_000,
    currency: "USD",
    marketCountry: "US",
    channel: "secondary_market",
    condition: "pre_owned",
    availability: "in_stock",
    url: "https://thewatchkingnyc.com/products/rolex-pearlmaster-39-diamond-pave-dial-pearlmaster-bracelet-white-gold-watch-86409rbr",
    title: "Rolex Pearlmaster 39 86409RBR current market listing",
    publisher: "The Watch King",
  },
  "268621-0003": {
    amountMinor: 1_775_000,
    currency: "USD",
    marketCountry: "US",
    channel: "authorized_dealer",
    condition: "new",
    availability: "waitlist_or_allocation",
    url: "https://www.rolex.com/en-us/watches/yacht-master/m268621-0003",
    title: "Rolex Yacht-Master 37 268621-0003",
    publisher: "Rolex",
    sourceType: "manufacturer_product",
  },
};

const FIT_OVERRIDES: Record<
  string,
  OverrideSource & {
    lugToLugMm: number;
    caseThicknessMm?: number;
    lugWidthMm?: number;
  }
> = {
  "124300": {
    lugToLugMm: 47.4,
    caseThicknessMm: 11.7,
    lugWidthMm: 21,
    url: "https://www.watchguys.com/pages/rolex-oyster-perpetual-124300-review",
    title: "Rolex Oyster Perpetual 41 124300 measured dimensions",
    publisher: "WatchGuys",
  },
  "126334": {
    lugToLugMm: 47.6,
    caseThicknessMm: 11.8,
    lugWidthMm: 21,
    url: "https://watch.the1916company.com/videos/rolex-datejust-41-126334-2",
    title: "Rolex Datejust 41 126334 measured dimensions",
    publisher: "The 1916 Company",
  },
  "126900": {
    lugToLugMm: 47,
    caseThicknessMm: 12,
    lugWidthMm: 21,
    url: "https://www.watchguys.com/pages/rolex-air-king-126900-review",
    title: "Rolex Air-King 126900 measured dimensions",
    publisher: "WatchGuys",
  },
  "50519-0006": {
    lugToLugMm: 45.3,
    caseThicknessMm: 12.4,
    url: "https://www.youtube.com/watch?v=7_Yg2zPus-A",
    title: "Rolex Cellini Date 50519 measured dimensions",
    publisher: "The 1916 Company",
  },
  "50505": {
    lugToLugMm: 45.2,
    caseThicknessMm: 11.1,
    url: "https://www.youtube.com/watch?v=orZX1dZpWOw",
    title: "Rolex Cellini Time 50505 measured dimensions",
    publisher: "The 1916 Company",
  },
  "278274": {
    lugToLugMm: 37,
    caseThicknessMm: 10.7,
    url: "https://www.thecalibre.co/watch/rolex-datejust-31-278274",
    title: "Rolex Datejust 31 278274 dimensions",
    publisher: "The Calibre",
  },
  "126300": {
    lugToLugMm: 47.5,
    caseThicknessMm: 11.6,
    lugWidthMm: 21,
    url: "https://www.watchguys.com/pages/rolex-datejust-41-126300-review",
    title: "Rolex Datejust 41 126300 measured dimensions",
    publisher: "WatchGuys",
  },
  "128238": {
    lugToLugMm: 43.3,
    caseThicknessMm: 11.7,
    url: "https://www.fratellowatches.com/hands-on-rolex-day-date-with-a-white-dial-and-deconstructed-roman-numerals/",
    title: "Rolex Day-Date 36 128238 dimensions",
    publisher: "Fratello",
  },
  "228238": {
    lugToLugMm: 47.4,
    caseThicknessMm: 12.1,
    lugWidthMm: 21,
    url: "https://watchspecs.com/watches/rolex-day-date-40-228238",
    title: "Rolex Day-Date 40 228238 dimensions",
    publisher: "WatchSpecs",
  },
  "124273-0001": {
    lugToLugMm: 43.2,
    caseThicknessMm: 11.5,
    lugWidthMm: 19,
    url: "https://www.youtube.com/watch?v=qM9rfepNTPM",
    title: "Rolex Explorer 124273 measured dimensions",
    publisher: "Ralf P",
  },
  "226570": {
    lugToLugMm: 50,
    caseThicknessMm: 12.3,
    lugWidthMm: 22,
    url: "https://www.rolexforums.com/~trfcom/showthread.php?page=3&t=805630",
    title: "Rolex Explorer II 226570 measured dimensions",
    publisher: "Rolex Forums",
  },
  "116400GV-0002": {
    lugToLugMm: 48.9,
    caseThicknessMm: 13,
    url: "https://www.youtube.com/watch?v=t-9GAIkJ4B0",
    title: "Rolex Milgauss 116400GV-0002 measured dimensions",
    publisher: "The 1916 Company",
  },
  "126710BLRO": {
    lugToLugMm: 48,
    url: "https://www.rolexforums.com/~trfcom/showthread.php?p=11285120",
    title: "Rolex GMT-Master II 126710BLRO measured dimensions",
    publisher: "Rolex Forums",
  },
  "279160": {
    lugToLugMm: 33.5,
    caseThicknessMm: 10.7,
    lugWidthMm: 14,
    url: "https://www.bernardwatch.com/Rolex/Ladies-Datejust-28/RLX9307",
    title: "Rolex Lady-Datejust 279160 measured dimensions",
    publisher: "Bernard Watch",
  },
  "279174": {
    lugToLugMm: 34,
    caseThicknessMm: 11,
    lugWidthMm: 14,
    url: "https://sheibanjewelers.com/products/pre-owned-rolex-lady-datejust-28mm-white-roman-dial-279174",
    title: "Rolex Lady-Datejust 28 279174 measured dimensions",
    publisher: "Sheiban Jewelers",
  },
  "276200": {
    lugToLugMm: 34,
    caseThicknessMm: 10.7,
    lugWidthMm: 14,
    url: "https://www.reddit.com/r/Watchexchange/comments/1v5bq0e/wts_2026_rolex_oyster_perpetual_28_med_blue_dial/",
    title: "Rolex Oyster Perpetual 28 measured dimensions",
    publisher: "Watchexchange",
  },
  "124200": {
    lugToLugMm: 40.1,
    url: "https://watchesoff5th.com/products/rolex-oyster-perpetual-34mm-oystersteel-candy-pink-dial-smooth-bezel-oyster-bracelet-ref-124200-0009",
    title: "Rolex Oyster Perpetual 34 measured dimensions",
    publisher: "WatchesOff5th",
  },
  "126000": {
    lugToLugMm: 43.1,
    caseThicknessMm: 11.6,
    lugWidthMm: 20,
    url: "https://watchesoff5th.com/blogs/videos/rolex-oyster-perpetual-36-multicoloured-126000-0016-unboxing",
    title: "Rolex Oyster Perpetual 36 measured dimensions",
    publisher: "WatchesOff5th",
  },
  "80319-0040": {
    lugToLugMm: 34,
    caseThicknessMm: 10.5,
    lugWidthMm: 14,
    url: "https://www.grayandsons.com/w525911-rolex-pearlmaster-29mm-80319/",
    title: "Rolex Pearlmaster 80319 measured dimensions",
    publisher: "Gray & Sons",
  },
  "268622": {
    lugToLugMm: 43.6,
    caseThicknessMm: 10.8,
    url: "https://www.youtube.com/watch?v=6IamIK2STAk",
    title: "Rolex Yacht-Master 37 268622 measured dimensions",
    publisher: "The 1916 Company",
  },
  "126622": {
    lugToLugMm: 48,
    caseThicknessMm: 11.7,
    url: "https://watchspecs.com/watches/rolex-yacht-master-126622",
    title: "Rolex Yacht-Master 40 126622 dimensions",
    publisher: "WatchSpecs",
  },
  "m226659-0002": {
    lugToLugMm: 50.2,
    caseThicknessMm: 11.8,
    lugWidthMm: 21,
    url: "https://www.youtube.com/watch?v=K-v2Y2jhG68",
    title: "Rolex Yacht-Master 42 226659-0002 measured dimensions",
    publisher: "The 1916 Company",
  },
  "116680": {
    lugToLugMm: 51,
    url: "https://watch.the1916company.com/versus/videos/rolex-watches-fit-guide-lug-to-lug-measures-wrist-fit-showcase-part-1",
    title: "Rolex Yacht-Master II 116680 measured dimensions",
    publisher: "The 1916 Company",
  },
  "116688": {
    lugToLugMm: 50.1,
    caseThicknessMm: 14,
    lugWidthMm: 21,
    url: "https://hailwoodpeters.com.au/en/watches/rolex-yacht-master-ii-1251993",
    title: "Rolex Yacht-Master II 116688 measured dimensions",
    publisher: "Hailwood Peters Watches",
  },
  "50509": {
    lugToLugMm: 45.3,
    caseThicknessMm: 11.2,
    url: "https://www.youtube.com/watch?v=RBWkrN-Ug-w",
    title: "Rolex Cellini Time 50509 measured dimensions",
    publisher: "The 1916 Company",
  },
  "50529": {
    lugToLugMm: 45.4,
    caseThicknessMm: 12.6,
    lugWidthMm: 20,
    url: "https://chronospex.com/rolex/cellini/cellini-dual-time/50529-0005/",
    title: "Rolex Cellini Dual Time 50529 measured dimensions",
    publisher: "Chronospex",
  },
};

const PRODUCT_URL_OVERRIDES: Record<string, string> = {
  "268621-0003":
    "https://www.rolex.com/en-us/watches/yacht-master/m268621-0003",
  "116680":
    "https://watchcharts.com/watch_model/1301-rolex-yacht-master-ii-116680/overview",
  "279174": "https://www.rolex.com/en-us/watches/lady-datejust/m279174-0019",
};

const REFERENCE_TO_EXISTING_ID: Record<string, string> = {
  "124060": "rolex-124060",
  "124270": "rolex-124270",
  "124273-0001": "rolex-124273",
  "126600": "rolex-126600",
};

function readJson(file: string) {
  return JSON.parse(
    fs.readFileSync(path.resolve(ROOT, file), "utf8"),
  ) as unknown;
}

function factMap(research: NormalizedResearch) {
  return new Map(research.facts.map((fact) => [fact.fieldName, fact]));
}

function stringValue(facts: Map<string, ProposedFact>, field: string) {
  const value = facts.get(field)?.value;
  return typeof value === "string" && value.trim() ? value : null;
}

function numberValue(facts: Map<string, ProposedFact>, field: string) {
  const value = facts.get(field)?.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(facts: Map<string, ProposedFact>, field: string) {
  const value = facts.get(field)?.value;
  return typeof value === "boolean" ? value : null;
}

function stringArrayValue(facts: Map<string, ProposedFact>, field: string) {
  const value = facts.get(field)?.value;
  if (Array.isArray(value))
    return value.filter((item): item is string => typeof item === "string");
  return typeof value === "string" ? [value] : [];
}

function variantId(referenceCode: string) {
  return `rolex-${referenceCode.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function sourceId(url: string, retrievedAt: string) {
  return `rolex-${createHash("sha256").update(`${url}\n${retrievedAt}`).digest("hex").slice(0, 20)}`;
}

function sourceType(sourceTypeValue: string) {
  if (sourceTypeValue === "manufacturer_manual")
    return "manufacturer_manual" as const;
  if (sourceTypeValue === "manufacturer_data_sheet")
    return "manufacturer_data_sheet" as const;
  if (sourceTypeValue === "manufacturer_product")
    return "manufacturer_product" as const;
  return "secondary_editorial" as const;
}

function normalizeProductionStatus(
  value: string | null,
  referenceCode: string,
) {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("discontinued")) return "discontinued" as const;
  if (normalized.includes("announced")) return "announced" as const;
  if (normalized.includes("current")) return "current" as const;
  throw new Error(`${referenceCode} has no supported production status.`);
}

function normalizeLugCurvature(value: string | null) {
  const normalized = value?.toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized.includes("flat") || normalized.includes("straight"))
    return "flat" as const;
  if (normalized.includes("steep")) return "steep" as const;
  return "moderate" as const;
}

function normalizeLume(value: string | null) {
  const normalized = value?.toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized.includes("none") || normalized.includes("no lume"))
    return "none" as const;
  if (normalized.includes("chroma") || normalized.includes("lumin"))
    return "strong" as const;
  return "moderate" as const;
}

function normalizeNickelRisk(value: string | null) {
  const normalized = value?.toLowerCase() ?? "";
  if (
    !normalized ||
    normalized.includes("unknown") ||
    normalized.includes("not stated")
  )
    return null;
  if (normalized.includes("none") || normalized.includes("inert"))
    return "none_known" as const;
  return "possible" as const;
}

function normalizeHypeRisk(value: string | null) {
  const normalized = value?.toLowerCase() ?? "";
  if (!normalized) return null;
  if (normalized.includes("high") || normalized.includes("elevated"))
    return "high" as const;
  if (normalized.includes("moderate") || normalized.includes("medium"))
    return "medium" as const;
  return "low" as const;
}

function normalizeBubble(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (
    normalized.includes("none") ||
    normalized.includes("no_") ||
    normalized.startsWith("no ") ||
    normalized.includes("no clear") ||
    normalized.includes("not clear") ||
    normalized.includes("not established") ||
    normalized.includes("low")
  ) {
    return false;
  }
  if (
    normalized.includes("medium") ||
    normalized.includes("high") ||
    normalized.includes("bubble")
  )
    return true;
  return null;
}

function normalizedComplications(values: string[]) {
  const joined = values.join(" ").toLowerCase();
  const complications: SeedReferenceVariant["complications"] = [];
  if (
    joined.includes("gmt") ||
    joined.includes("time zone") ||
    joined.includes("second_time_zone")
  )
    complications.push("gmt");
  if (
    joined.includes("chronograph") ||
    joined.includes("regatta") ||
    joined.includes("countdown")
  )
    complications.push("chronograph");
  if (joined.includes("moonphase")) complications.push("moonphase");
  if (joined.includes("world time")) complications.push("world_time");
  return [...new Set(complications)];
}

function dateStatus(
  value: string | null,
  complications: string[],
  model: string,
  referenceCode: string,
) {
  const joined =
    `${value ?? ""} ${complications.join(" ")} ${model}`.toLowerCase();
  if (
    joined.includes("no_date") ||
    joined.includes("no date") ||
    joined.includes("time_only")
  )
    return "absent" as const;
  if (joined.includes("date") || joined.includes("calendar"))
    return "present" as const;
  if (referenceCode === "126900") return "absent" as const;
  throw new Error(`${referenceCode} has no supported date-status evidence.`);
}

function normalizeMovementType(value: string | null, referenceCode: string) {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("automatic") || normalized.includes("self-winding")) {
    return "automatic" as const;
  }
  if (normalized.includes("manual") || normalized.includes("hand-wound")) {
    return "manual" as const;
  }
  throw new Error(`${referenceCode} has no supported movement type.`);
}

function normalizeAvailability(value: string | null) {
  const normalized = value?.toLowerCase() ?? "";
  if (!normalized) return "unknown" as const;
  if (
    normalized.includes("limited") ||
    normalized.includes("allocation") ||
    normalized.includes("constrained")
  ) {
    return "waitlist_or_allocation" as const;
  }
  if (
    normalized.includes("secondary") ||
    normalized.includes("pre-owned") ||
    normalized.includes("pre_owned")
  ) {
    return "in_stock" as const;
  }
  if (normalized.includes("not_officially_available"))
    return "unavailable" as const;
  return "unknown" as const;
}

function normalizeAttachmentType(
  value: string | null,
  integrated: boolean | null,
) {
  if (integrated === true) return "integrated" as const;
  const normalized = value?.toLowerCase() ?? "";
  if (
    normalized.includes("spring") ||
    normalized.includes("conventional") ||
    normalized.includes("standard lug")
  ) {
    return "spring_bar" as const;
  }
  return null;
}

function normalizeShockResistance(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;
  const normalized = value.toLowerCase();
  if (
    normalized.includes("paraflex") ||
    normalized.includes("shock protection") ||
    normalized.includes("shock-resistant") ||
    normalized.includes("shock resistant")
  ) {
    return true;
  }
  return null;
}

function editorialProfile(model: string, collection: string) {
  const name = `${collection} ${model}`.toLowerCase();
  const professional = [
    "submariner",
    "sea-dweller",
    "deepsea",
    "explorer",
    "gmt-master",
    "air-king",
    "yacht-master",
  ].some((term) => name.includes(term));
  const formal = ["cellini", "1908", "day-date", "pearlmaster"].some((term) =>
    name.includes(term),
  );
  return {
    eligibleEnvironments: professional
      ? (["field_water_abuse", "studio_desk_daily"] as const)
      : (["studio_desk_daily", "formal_architectural"] as const),
    ownershipFrictionLevels: formal
      ? (["specialist_mechanical"] as const)
      : (["workhorse_mechanical", "specialist_mechanical"] as const),
    traits: {
      primaryArchetype: professional
        ? "professional benchmark"
        : formal
          ? "formal milestone"
          : "enduring daily classic",
      socialSignals: professional
        ? (["unapologetic_benchmark", "discreet_competence"] as const)
        : (["quiet_continuity", "unapologetic_benchmark"] as const),
      aestheticDna: professional
        ? (["structural_tool", "mid_century_industrial"] as const)
        : formal
          ? (["high_art", "mid_century_industrial"] as const)
          : (["mid_century_industrial"] as const),
      emotionalObjectives: formal
        ? (["milestone", "custody"] as const)
        : (["dependability", "milestone"] as const),
    },
  };
}

const rawCatalogue = seedCatalogueSchema.parse(
  readJson("data/catalogue/seed-catalogue.json"),
);
const sourceRegistry = new Map(
  rawCatalogue.sources.map((source) => [
    `${source.url}\n${source.retrievedAt}`,
    source,
  ]),
);

function registerFactSource(fact: ProposedFact, referenceCode: string) {
  const key = `${fact.sourceUrl}\n${fact.retrievedAt}`;
  const existing = sourceRegistry.get(key);
  if (existing) return existing.id;
  const hostname = new URL(fact.sourceUrl).hostname.replace(/^www\./, "");
  const source: SeedCatalogue["sources"][number] = {
    id: sourceId(fact.sourceUrl, fact.retrievedAt),
    url: fact.sourceUrl,
    title: `Rolex ${referenceCode}: ${fact.fieldName} evidence`,
    publisher: hostname,
    sourceType: sourceType(fact.sourceType),
    retrievedAt: fact.retrievedAt,
  };
  sourceRegistry.set(key, source);
  return source.id;
}

function registerOverrideSource(source: OverrideSource) {
  const key = `${source.url}\n${PROMOTED_AT}`;
  const existing = sourceRegistry.get(key);
  if (existing) return existing.id;
  const entry: SeedCatalogue["sources"][number] = {
    id: sourceId(source.url, PROMOTED_AT),
    url: source.url,
    title: source.title,
    publisher: source.publisher,
    sourceType: source.sourceType ?? "secondary_editorial",
    retrievedAt: PROMOTED_AT,
  };
  sourceRegistry.set(key, entry);
  return entry.id;
}

function addEvidence(
  evidence: Map<string, Set<EvidenceField>>,
  source: string,
  field: EvidenceField,
) {
  const fields = evidence.get(source) ?? new Set<EvidenceField>();
  fields.add(field);
  evidence.set(source, fields);
}

function evidenceFromFact(
  evidence: Map<string, Set<EvidenceField>>,
  facts: Map<string, ProposedFact>,
  factName: string,
  field: EvidenceField,
  referenceCode: string,
) {
  const fact = facts.get(factName);
  if (!fact || fact.value === null || fact.evidenceKind === "missing") return;
  addEvidence(evidence, registerFactSource(fact, referenceCode), field);
}

function buildVariant(
  research: NormalizedResearch,
  requestedReferenceCode?: string,
): SeedReferenceVariant {
  const referenceCode =
    requestedReferenceCode ?? research.candidateIdentity.referenceCode;
  const facts = factMap(research);
  const priceOverride = PRICE_OVERRIDES[referenceCode];
  const fitOverride = FIT_OVERRIDES[referenceCode];
  const productionStatus = normalizeProductionStatus(
    stringValue(facts, "productionStatus"),
    referenceCode,
  );
  const complicationValues = stringArrayValue(facts, "complications");
  const complications = normalizedComplications(complicationValues);
  const profile = editorialProfile(
    research.candidateIdentity.model,
    stringValue(facts, "collection") ?? research.candidateIdentity.model,
  );
  const evidence = new Map<string, Set<EvidenceField>>();

  const movementType = normalizeMovementType(
    stringValue(facts, "movement.type"),
    referenceCode,
  );
  const movementLower = numberValue(facts, "movement.accuracyLowerSeconds");
  const movementUpper = numberValue(facts, "movement.accuracyUpperSeconds");
  const rawAccuracyPeriod = numberValue(facts, "movement.accuracyPeriodDays");
  const accuracyPeriod =
    rawAccuracyPeriod ??
    (movementLower !== null && movementUpper !== null ? 1 : null);
  const integratedBracelet = booleanValue(facts, "geometry.integratedBracelet");
  const lugCurvature = normalizeLugCurvature(
    stringValue(facts, "geometry.lugCurvature"),
  );
  const crownType = stringValue(facts, "operation.crownType")
    ?.toLowerCase()
    .includes("screw")
    ? ("screw_down" as const)
    : null;
  const crownPosition =
    stringValue(facts, "operation.crownPosition") === null
      ? null
      : ("3" as const);
  const crystal = stringValue(facts, "operation.crystal")
    ?.toLowerCase()
    .includes("sapphire")
    ? ("sapphire" as const)
    : null;
  const lumeGrade = normalizeLume(stringValue(facts, "operation.lumeGrade"));
  const attachmentType = normalizeAttachmentType(
    stringValue(facts, "operation.attachmentType"),
    integratedBracelet,
  );
  const shockResistant = normalizeShockResistance(
    facts.get("operation.shockResistant")?.value,
  );
  const nickelContactRisk = normalizeNickelRisk(
    stringValue(facts, "operation.nickelContactRisk"),
  );
  const date = dateStatus(
    stringValue(facts, "dateStatus"),
    complicationValues,
    research.candidateIdentity.model,
    referenceCode,
  );
  const speculativeBubble = normalizeBubble(
    facts.get("market.speculativeBubble")?.value,
  );
  const hypeRisk = normalizeHypeRisk(stringValue(facts, "market.hypeRisk"));
  const secondaryRatioLow = numberValue(facts, "market.secondaryRatioLow");
  const secondaryRatioHigh = numberValue(facts, "market.secondaryRatioHigh");

  const normalizedPrice = numberValue(facts, "price.amountMinor");
  if (!priceOverride && normalizedPrice === null)
    throw new Error(`${referenceCode} has no price after overrides.`);
  const priceFact = facts.get("price.amountMinor");
  if (priceOverride)
    addEvidence(evidence, registerOverrideSource(priceOverride), "price");
  else if (priceFact)
    addEvidence(
      evidence,
      registerFactSource(priceFact, referenceCode),
      "price",
    );

  const factEvidence: Array<[string, EvidenceField]> = [
    ["referenceCode", "identity"],
    ["materials.case", "materials"],
    ["productionStatus", "productionStatus"],
    ["geometry.caseDiameterMm", "caseDiameterMm"],
    ["geometry.caseThicknessMm", "caseThicknessMm"],
    ["geometry.lugToLugMm", "lugToLugMm"],
    ["geometry.lugWidthMm", "lugWidthMm"],
    ["geometry.weightFullG", "weightFullG"],
    ["movement.type", "movement"],
    ["operation.waterResistanceM", "waterResistanceM"],
    ["complications", "complications"],
  ];
  factEvidence.forEach(([factName, field]) =>
    evidenceFromFact(evidence, facts, factName, field, referenceCode),
  );
  const normalizedEvidence: Array<[string, EvidenceField, unknown]> = [
    ["geometry.lugCurvature", "lugCurvature", lugCurvature],
    ["geometry.integratedBracelet", "integratedBracelet", integratedBracelet],
    ["operation.crownType", "crownType", crownType],
    ["operation.crownPosition", "crownPosition", crownPosition],
    ["operation.crystal", "crystal", crystal],
    ["operation.lumeGrade", "lumeGrade", lumeGrade],
    ["operation.attachmentType", "attachmentType", attachmentType],
    ["operation.shockResistant", "shockResistant", shockResistant],
    ["operation.nickelContactRisk", "nickelContactRisk", nickelContactRisk],
    ["market.speculativeBubble", "market", speculativeBubble],
    ["market.hypeRisk", "market", hypeRisk],
    [
      "market.secondaryRatioLow",
      "market",
      numberValue(facts, "market.secondaryRatioLow"),
    ],
  ];
  normalizedEvidence.forEach(([factName, field, normalizedValue]) => {
    if (normalizedValue !== null) {
      evidenceFromFact(evidence, facts, factName, field, referenceCode);
    }
  });
  if (
    movementLower !== null &&
    movementUpper !== null &&
    accuracyPeriod !== null
  ) {
    evidenceFromFact(
      evidence,
      facts,
      "movement.accuracyLowerSeconds",
      "accuracy",
      referenceCode,
    );
  }
  const identityFact = facts.get("referenceCode") ?? facts.get("identity");
  if (!identityFact)
    throw new Error(`${referenceCode} has no identity evidence.`);
  const identitySource = registerFactSource(identityFact, referenceCode);
  if (stringValue(facts, "dateStatus") === null) {
    addEvidence(evidence, identitySource, "dateStatus");
  } else {
    evidenceFromFact(
      evidence,
      facts,
      "dateStatus",
      "dateStatus",
      referenceCode,
    );
  }
  if (fitOverride) {
    const fitSource = registerOverrideSource(fitOverride);
    addEvidence(evidence, fitSource, "lugToLugMm");
    if (fitOverride.caseThicknessMm !== undefined)
      addEvidence(evidence, fitSource, "caseThicknessMm");
    if (fitOverride.lugWidthMm !== undefined)
      addEvidence(evidence, fitSource, "lugWidthMm");
  }

  if (rawAccuracyPeriod === null && accuracyPeriod === 1)
    evidenceFromFact(
      evidence,
      facts,
      "movement.accuracyLowerSeconds",
      "accuracy",
      referenceCode,
    );

  const priceSourceId = priceOverride
    ? registerOverrideSource(priceOverride)
    : priceFact
      ? registerFactSource(priceFact, referenceCode)
      : identitySource;
  const availabilityFact = facts.get("price.availability");
  const availability =
    priceOverride?.availability ??
    normalizeAvailability(stringValue(facts, "price.availability"));
  const marketObservationRetained =
    availability !== "unknown" ||
    speculativeBubble !== null ||
    hypeRisk !== null ||
    secondaryRatioLow !== null ||
    secondaryRatioHigh !== null;
  if (priceOverride && availability !== "unknown") {
    addEvidence(evidence, priceSourceId, "availability");
  } else if (availabilityFact && availability !== "unknown") {
    addEvidence(
      evidence,
      registerFactSource(availabilityFact, referenceCode),
      "availability",
    );
  }
  const productUrl =
    PRODUCT_URL_OVERRIDES[referenceCode] ?? stringValue(facts, "productUrl");
  if (!productUrl) throw new Error(`${referenceCode} has no product URL.`);

  return {
    id: variantId(referenceCode),
    brand: { slug: "rolex", name: "Rolex", serviceCountries: null },
    collection:
      stringValue(facts, "collection") ?? research.candidateIdentity.model,
    model: research.candidateIdentity.model,
    referenceCode,
    variantName:
      stringValue(facts, "variantName") ??
      research.candidateIdentity.variantName,
    productUrl,
    price: {
      amountMinor: priceOverride?.amountMinor ?? normalizedPrice!,
      currency:
        priceOverride?.currency ??
        (stringValue(facts, "price.currency") as "USD" | "EUR"),
      marketCountry:
        priceOverride?.marketCountry ??
        (stringValue(facts, "price.marketCountry") === "United States"
          ? "US"
          : stringValue(facts, "price.marketCountry"))!,
      observedAt: PROMOTED_AT,
      staleAfter: STALE_AFTER,
      availability,
      availabilityObservedAt: marketObservationRetained ? PROMOTED_AT : null,
      availabilityStaleAfter: marketObservationRetained ? STALE_AFTER : null,
      channels: [
        priceOverride?.channel ??
          (productionStatus === "discontinued"
            ? "secondary_market"
            : "authorized_dealer"),
      ],
      conditions: [
        priceOverride?.condition ??
          (productionStatus === "discontinued" ? "pre_owned" : "new"),
      ],
    },
    materials: {
      case: stringValue(facts, "materials.case"),
      caseback: stringValue(facts, "materials.caseback"),
      bracelet: stringValue(facts, "materials.bracelet"),
      strap: stringValue(facts, "materials.strap"),
      displayCaseback: null,
    },
    productionStatus,
    geometry: {
      caseDiameterMm: numberValue(facts, "geometry.caseDiameterMm"),
      caseWidthMm: null,
      caseLengthMm: null,
      caseThicknessMm:
        fitOverride?.caseThicknessMm ??
        numberValue(facts, "geometry.caseThicknessMm"),
      lugToLugMm:
        fitOverride?.lugToLugMm ?? numberValue(facts, "geometry.lugToLugMm"),
      lugWidthMm:
        fitOverride?.lugWidthMm ?? numberValue(facts, "geometry.lugWidthMm"),
      weightFullG: numberValue(facts, "geometry.weightFullG"),
      lugCurvature,
      integratedBracelet,
      caseShape: null,
    },
    fieldApplicability: {},
    movement: {
      type: movementType,
      caliber: stringValue(facts, "movement.caliber"),
      powerReserveHours: numberValue(facts, "movement.powerReserveHours"),
      accuracyLowerSeconds: movementLower,
      accuracyUpperSeconds: movementUpper,
      accuracyPeriodDays: accuracyPeriod,
      construction: null,
    },
    operation: {
      waterResistanceM: numberValue(facts, "operation.waterResistanceM"),
      crownType,
      crownPosition,
      crystal,
      lumeGrade,
      attachmentType,
      shockResistant,
      nickelContactRisk,
      microAdjustment: null,
    },
    positioningLine: null,
    positioningGroup: null,
    wearingScenarios: [],
    complicationSlugs: [],
    complications,
    dateStatus: date,
    eligibleEnvironments: [...profile.eligibleEnvironments],
    ownershipFrictionLevels: [...profile.ownershipFrictionLevels],
    traits: {
      primaryArchetype: profile.traits.primaryArchetype,
      socialSignals: [...profile.traits.socialSignals],
      aestheticDna: [...profile.traits.aestheticDna],
      emotionalObjectives: [...profile.traits.emotionalObjectives],
    },
    market: {
      speculativeBubble,
      hypeRisk,
      secondaryRatioLow,
      secondaryRatioHigh,
    },
    evidence: [...evidence.entries()].map(([registeredSourceId, fields]) => ({
      sourceId: registeredSourceId,
      fields: [...fields].sort(),
    })),
  };
}

const intake = researchWorkbookIntakeSchema.parse(
  readJson("data/research/rolex-workbook-intake.json"),
);
const ownerIntake = ownerReferenceIntakeSchema.parse(
  readJson("data/research/rolex-owner-reference-intake.json"),
);
const ownerResearchTargets = ownerIntake.targets.filter((target) =>
  target.targetId.startsWith("rolex-owner-"),
);
const jobs = fs
  .readdirSync(path.resolve(ROOT, "data/research/jobs"))
  .filter((file) => file.endsWith(".json"))
  .map(
    (file) =>
      readJson(path.join("data/research/jobs", file)) as {
        jobId: string;
        targetId: string;
        status: string;
        completedAt: string | null;
        normalizedArtifactPath: string | null;
      },
  );

const researchByTarget = new Map<string, NormalizedResearch>();
const jobByTarget = new Map<string, (typeof jobs)[number]>();
for (const target of [
  ...intake.targets.map(({ id }) => ({ id })),
  ...ownerResearchTargets.map(({ targetId }) => ({ id: targetId })),
]) {
  const job = jobs
    .filter(
      (candidate) =>
        candidate.targetId === target.id &&
        candidate.status === "succeeded" &&
        candidate.normalizedArtifactPath,
    )
    .sort(
      (left, right) =>
        Date.parse(right.completedAt ?? "") -
        Date.parse(left.completedAt ?? ""),
    )[0];
  if (!job?.normalizedArtifactPath)
    throw new Error(`No normalized research for ${target.id}.`);
  researchByTarget.set(
    target.id,
    readJson(job.normalizedArtifactPath) as NormalizedResearch,
  );
  jobByTarget.set(target.id, job);
}

const preservedRolex = new Map(
  rawCatalogue.variants
    .filter((variant) => variant.brand.slug === "rolex")
    .map((variant) => [variant.id, structuredClone(variant)]),
);
const workbookVariants: SeedReferenceVariant[] = [];
for (const target of intake.targets) {
  const research = researchByTarget.get(target.id)!;
  const existingId =
    REFERENCE_TO_EXISTING_ID[research.candidateIdentity.referenceCode];
  if (existingId) continue;
  workbookVariants.push(
    seedCatalogueSchema.shape.variants.element.parse(buildVariant(research)),
  );
}
const ownerVariants = ownerResearchTargets.map((target) =>
  seedCatalogueSchema.shape.variants.element.parse(
    buildVariant(researchByTarget.get(target.targetId)!, target.referenceCode),
  ),
);

const explorer270 = preservedRolex.get("rolex-124270")!;
const explorer270Research = researchByTarget.get(
  "rolex-workbook-explorer-36-124270-gap",
)!;
const explorer270Facts = factMap(explorer270Research);
explorer270.geometry.caseThicknessMm = numberValue(
  explorer270Facts,
  "geometry.caseThicknessMm",
);
explorer270.geometry.lugToLugMm = numberValue(
  explorer270Facts,
  "geometry.lugToLugMm",
);
explorer270.geometry.lugWidthMm = numberValue(
  explorer270Facts,
  "geometry.lugWidthMm",
);
explorer270.geometry.weightFullG = numberValue(
  explorer270Facts,
  "geometry.weightFullG",
);
const explorer270Source = registerFactSource(
  explorer270Facts.get("geometry.lugToLugMm")!,
  "124270",
);
explorer270.evidence = explorer270.evidence.filter(
  (entry) => entry.sourceId !== explorer270Source,
);
explorer270.evidence.push({
  sourceId: explorer270Source,
  fields: ["caseThicknessMm", "lugToLugMm", "lugWidthMm", "weightFullG"],
});

const explorer273 = preservedRolex.get("rolex-124273")!;
explorer273.referenceCode = "124273-0001";
const explorer273Fit = FIT_OVERRIDES["124273-0001"]!;
explorer273.geometry.caseThicknessMm = explorer273Fit.caseThicknessMm ?? null;
explorer273.geometry.lugToLugMm = explorer273Fit.lugToLugMm;
explorer273.geometry.lugWidthMm = explorer273Fit.lugWidthMm ?? null;
const explorer273Source = registerOverrideSource(explorer273Fit);
explorer273.evidence = explorer273.evidence.filter(
  (entry) => entry.sourceId !== explorer273Source,
);
explorer273.evidence.push({
  sourceId: explorer273Source,
  fields: ["identity", "caseThicknessMm", "lugToLugMm", "lugWidthMm"],
});

const nextVariants = [
  ...rawCatalogue.variants.filter((variant) => variant.brand.slug !== "rolex"),
  explorer270,
  explorer273,
  preservedRolex.get("rolex-124060")!,
  preservedRolex.get("rolex-126600")!,
  ...workbookVariants,
  ...ownerVariants,
].sort((left, right) => left.id.localeCompare(right.id));
const retainedSourceIds = new Set([
  rawCatalogue.fx.sourceId,
  ...nextVariants.flatMap((variant) =>
    variant.evidence.map((entry) => entry.sourceId),
  ),
]);
const nextCatalogue = seedCatalogueSchema.parse({
  ...rawCatalogue,
  sources: [...sourceRegistry.values()].filter((source) =>
    retainedSourceIds.has(source.id),
  ),
  variants: nextVariants,
});

const manifest = researchManifestSchema.parse(
  readJson("data/research/brand-manifest.json"),
);
const rolex = manifest.brands.find((brand) => brand.slug === "rolex");
if (!rolex) throw new Error("Rolex manifest entry is missing.");
for (const target of rolex.targets) {
  if (
    !target.id.startsWith("rolex-workbook-") &&
    !target.id.startsWith("rolex-owner-")
  ) {
    continue;
  }
  const research = researchByTarget.get(target.id);
  if (!research) continue;
  const requestedReferenceCode = ownerResearchTargets.find(
    (candidate) => candidate.targetId === target.id,
  )?.referenceCode;
  target.state = "accepted";
  target.catalogueVariantId =
    REFERENCE_TO_EXISTING_ID[research.candidateIdentity.referenceCode] ??
    variantId(
      requestedReferenceCode ?? research.candidateIdentity.referenceCode,
    );
  delete target.coverageIntent;
}
manifest.updatedAt = PROMOTED_AT;

for (const target of intake.targets) {
  const reviewPath = path.resolve(
    ROOT,
    "data/research/reviewed",
    `${target.id}.json`,
  );
  const review = researchReviewSchema.parse(
    readJson(path.relative(ROOT, reviewPath)),
  );
  const independentlyReady = new Set(["124060", "126600"]).has(
    review.candidateIdentity.referenceCode,
  );
  review.outcome = independentlyReady
    ? "ready_for_migration"
    : "owner_approved_for_recommendation";
  review.reviewedAt = PROMOTED_AT;
  review.reviewer = independentlyReady
    ? "codex-source-review"
    : "owner-directed-catalogue-promotion";
  review.note = independentlyReady
    ? "Independent exact-reference review remains migration-ready; the owner also confirmed that the complete researched Rolex set should participate in recommendations."
    : "Owner explicitly approved every researched Rolex exact reference for the recommendation catalogue on 2026-08-31. Existing source provenance is retained, newly checked price and wearing-span evidence is added where available, and every unresolved fact remains null so an active hard filter cannot pass silently.";
  fs.writeFileSync(
    reviewPath,
    `${JSON.stringify(researchReviewSchema.parse(review), null, 2)}\n`,
  );
}

function missingM1Fields(research: NormalizedResearch, referenceCode: string) {
  const facts = factMap(research);
  const hasFact = (fieldName: string) => {
    const fact = facts.get(fieldName);
    return (
      fact !== undefined &&
      fact.value !== null &&
      fact.evidenceKind !== "missing"
    );
  };
  const priceOverride = PRICE_OVERRIDES[referenceCode];
  const fitOverride = FIT_OVERRIDES[referenceCode];
  const available = new Set<(typeof M1_REVIEW_FIELDS)[number]>();
  if (hasFact("identity") || hasFact("referenceCode")) {
    available.add("identity");
  }
  if (priceOverride || hasFact("price.amountMinor")) available.add("price");
  if (hasFact("geometry.caseDiameterMm")) available.add("caseDiameterMm");
  if (hasFact("geometry.caseWidthMm")) available.add("caseWidthMm");
  if (hasFact("geometry.caseLengthMm")) available.add("caseLengthMm");
  if (fitOverride?.caseThicknessMm || hasFact("geometry.caseThicknessMm")) {
    available.add("caseThicknessMm");
  }
  if (fitOverride?.lugToLugMm || hasFact("geometry.lugToLugMm")) {
    available.add("lugToLugMm");
  }
  if (fitOverride?.lugWidthMm || hasFact("geometry.lugWidthMm")) {
    available.add("lugWidthMm");
  }
  if (hasFact("geometry.weightFullG")) available.add("weightFullG");
  if (hasFact("movement.type")) available.add("movement");
  if (
    hasFact("movement.accuracyLowerSeconds") &&
    hasFact("movement.accuracyUpperSeconds")
  ) {
    available.add("accuracy");
  }
  if (hasFact("operation.waterResistanceM")) {
    available.add("waterResistanceM");
  }
  if (hasFact("operation.lumeGrade")) available.add("lumeGrade");
  if (hasFact("operation.attachmentType")) {
    available.add("attachmentType");
  }
  if (hasFact("dateStatus")) available.add("dateStatus");
  return M1_REVIEW_FIELDS.filter((field) => !available.has(field));
}

function buildOwnerReview(
  target: (typeof ownerResearchTargets)[number],
): ResearchReview {
  const research = researchByTarget.get(target.targetId)!;
  const job = jobByTarget.get(target.targetId)!;
  const facts = factMap(research);
  const identityFact = facts.get("referenceCode") ?? facts.get("identity")!;
  const priceOverride = PRICE_OVERRIDES[target.referenceCode];
  const fitOverride = FIT_OVERRIDES[target.referenceCode];
  const sourceChecks = new Map<
    string,
    ResearchReview["sourceChecks"][number]
  >();
  sourceChecks.set(identityFact.sourceUrl, {
    url: identityFact.sourceUrl,
    status: identityFact.sourceType.startsWith("manufacturer_")
      ? "validated_primary"
      : "validated_secondary",
    note: `Exact-reference identity evidence retained from the ${identityFact.sourceType} research claim.`,
  });
  for (const supplement of [priceOverride, fitOverride]) {
    if (!supplement) continue;
    sourceChecks.set(supplement.url, {
      url: supplement.url,
      status: supplement.sourceType?.startsWith("manufacturer_")
        ? "validated_primary"
        : "validated_secondary",
      note: "Supplemental exact-reference price or wearing-dimension evidence checked during owner-approved promotion.",
    });
  }

  const additionalVerifiedFacts: ResearchReview["additionalVerifiedFacts"] = [];
  if (priceOverride) {
    additionalVerifiedFacts.push({
      fieldName: "price.amountMinor",
      value: priceOverride.amountMinor,
      sourceUrl: priceOverride.url,
      note: `${priceOverride.currency} amount stored in minor units for the stated market and condition.`,
    });
  }
  if (fitOverride) {
    additionalVerifiedFacts.push({
      fieldName: "geometry.lugToLugMm",
      value: fitOverride.lugToLugMm,
      sourceUrl: fitOverride.url,
      note: "Exact-reference wearing span used by the wrist fit filter.",
    });
    if (fitOverride.caseThicknessMm !== undefined) {
      additionalVerifiedFacts.push({
        fieldName: "geometry.caseThicknessMm",
        value: fitOverride.caseThicknessMm,
        sourceUrl: fitOverride.url,
        note: "Exact-reference case thickness supplement.",
      });
    }
    if (fitOverride.lugWidthMm !== undefined) {
      additionalVerifiedFacts.push({
        fieldName: "geometry.lugWidthMm",
        value: fitOverride.lugWidthMm,
        sourceUrl: fitOverride.url,
        note: "Exact-reference lug width supplement.",
      });
    }
  }

  return researchReviewSchema.parse({
    reviewVersion: 1,
    targetId: target.targetId,
    jobId: job.jobId,
    reviewedAt: PROMOTED_AT,
    reviewer: "owner-directed-catalogue-promotion",
    outcome: "owner_approved_for_recommendation",
    candidateIdentity: {
      ...research.candidateIdentity,
      referenceCode: target.referenceCode,
    },
    sourceChecks: [...sourceChecks.values()],
    verifiedProvisionalFields: ["identity", "referenceCode", "productUrl"],
    additionalVerifiedFacts,
    rejectedProvisionalFields: [],
    missingM1Fields: missingM1Fields(research, target.referenceCode),
    note: "Owner explicitly supplied, researched, and approved this exact Rolex reference for the recommendation catalogue on 2026-08-31. Provisional claims retain source provenance; supplemental price and wearing-span checks are recorded explicitly; unresolved facts remain null and cannot satisfy active hard filters.",
  });
}

for (const target of ownerResearchTargets) {
  const review = buildOwnerReview(target);
  fs.writeFileSync(
    path.resolve(ROOT, "data/research/reviewed", `${target.targetId}.json`),
    `${JSON.stringify(review, null, 2)}\n`,
  );
}

for (const approved of ownerIntake.targets) {
  const normalizedReference = approved.referenceCode.toUpperCase();
  const match = nextCatalogue.variants.find((variant) => {
    if (variant.brand.slug !== ownerIntake.brandSlug) return false;
    const candidate = variant.referenceCode.toUpperCase();
    return (
      candidate === normalizedReference ||
      candidate.startsWith(`${normalizedReference}-`)
    );
  });
  if (!match) {
    throw new Error(
      `Owner-approved Rolex reference is absent from the catalogue: ${approved.referenceCode}.`,
    );
  }
}

fs.writeFileSync(
  path.resolve(ROOT, "data/catalogue/seed-catalogue.json"),
  `${JSON.stringify(nextCatalogue, null, 2)}\n`,
);
fs.writeFileSync(
  path.resolve(ROOT, "data/research/brand-manifest.json"),
  `${JSON.stringify(researchManifestSchema.parse(manifest), null, 2)}\n`,
);

console.log(
  `Promoted ${nextCatalogue.variants.filter((variant) => variant.brand.slug === "rolex").length} exact Rolex references; catalogue now contains ${nextCatalogue.variants.length} variants.`,
);

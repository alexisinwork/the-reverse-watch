import type { DiscoveryPilotCorpus } from "./discovery";

const reviewedAt = "2026-08-31T18:00:00.000Z";

type SourceRole =
  | "official_production_record"
  | "direct_interview"
  | "primary_visual"
  | "contemporaneous_reporting"
  | "specialist_corroboration"
  | "other";

type WorkKind =
  | "film"
  | "television_series"
  | "television_episode"
  | "documentary"
  | "music_video"
  | "other";

type StorySeed = {
  id: number;
  slug: string;
  headline: string;
  summary: string;
  entityKind: "public_figure" | "fictional_character";
  displayName: string;
  disambiguation?: string;
  work?: {
    kind: WorkKind;
    title: string;
    slug: string;
    releaseDate: string | null;
  };
  event?: {
    kind:
      | "premiere"
      | "award_ceremony"
      | "interview"
      | "sporting_event"
      | "public_appearance"
      | "other";
    title: string;
    slug: string;
    occurredOn: string | null;
    location: string | null;
  };
  claimType:
    "owned" | "worn_publicly" | "screen_worn" | "reported" | "unconfirmed";
  precision: "exact_reference" | "model_family" | "brand_only" | "unidentified";
  brand?: string;
  model?: string;
  reference?: string;
  confidence: "confirmed" | "family_only" | "unconfirmed";
  observedOn?: string;
  sceneLocator?: string;
  editorialNote: string;
  source: {
    id: number;
    url: string;
    title: string;
    publisher: string;
    sourceType: string;
    role: SourceRole;
    publishedAt?: string;
    locator?: string;
    editorialNote: string;
  };
};

function sourceUuid(id: number) {
  return `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`;
}

function buildStory(seed: StorySeed) {
  if (seed.work && seed.event) {
    throw new Error(
      `Pilot story ${seed.slug} cannot have work and event context.`,
    );
  }

  const work = seed.work
    ? {
        id: seed.id,
        parentWorkId: null,
        workKind: seed.work.kind,
        slug: seed.work.slug,
        title: seed.work.title,
        releaseDate: seed.work.releaseDate,
        seasonNumber: null,
        episodeNumber: null,
        reviewStatus: "accepted" as const,
      }
    : null;
  const event = seed.event
    ? {
        id: seed.id,
        eventKind: seed.event.kind,
        slug: seed.event.slug,
        title: seed.event.title,
        occurredOn: seed.event.occurredOn,
        endedOn: null,
        location: seed.event.location,
        reviewStatus: "accepted" as const,
      }
    : null;

  return {
    slug: seed.slug,
    headline: seed.headline,
    summary: seed.summary,
    entity: {
      id: seed.id,
      entityKind: seed.entityKind,
      slug: `${seed.slug}-entity`,
      displayName: seed.displayName,
      disambiguation: seed.disambiguation ?? null,
      reviewStatus: "accepted" as const,
    },
    work,
    event,
    publication: {
      attribution: {
        id: seed.id,
        entityId: seed.id,
        workId: work?.id ?? null,
        eventId: event?.id ?? null,
        referenceVariantId: null,
        claimType: seed.claimType,
        identificationPrecision: seed.precision,
        identifiedBrand: seed.brand ?? null,
        identifiedModelFamily: seed.model ?? null,
        identifiedReferenceCode: seed.reference ?? null,
        confidenceCode: seed.confidence,
        disputeState: "clear" as const,
        observedOn: seed.observedOn ?? null,
        sceneLocator: seed.sceneLocator ?? null,
        editorialNote: seed.editorialNote,
        reviewStatus: "accepted" as const,
        publishedAt: reviewedAt,
      },
      evidence: [
        {
          id: seed.id,
          attributionId: seed.id,
          source: {
            id: sourceUuid(seed.source.id),
            url: seed.source.url,
            title: seed.source.title,
            publisher: seed.source.publisher,
            sourceType: seed.source.sourceType,
            publishedAt: seed.source.publishedAt ?? null,
            retrievedAt: reviewedAt,
            archivedUrl: null,
          },
          stance: "supports" as const,
          sourceRole: seed.source.role,
          sourceLocator: seed.source.locator ?? null,
          excerpt: null,
          editorialNote: seed.source.editorialNote,
          observedAt: null,
          reviewStatus: "accepted" as const,
          reviewedAt,
        },
      ],
      imageRights: {
        attributionId: seed.id,
        imageState: "no_image_stored" as const,
        assetUrl: null,
        rightsBasis: null,
        rightsHolder: null,
        licenceName: null,
        licenceUrl: null,
        creditLine: null,
        expiresAt: null,
        reviewedAt,
        editorialNote:
          "Packet 8.2 is text-only; the cited source image is not copied or stored.",
      },
      corrections: [],
    },
  };
}

const oppenheimerSource = {
  id: 4,
  url: "https://www.hamiltonwatch.com/en-us/watches-oppenheimer",
  title: "Oppenheimer | Precision Storytelling",
  publisher: "Hamilton",
  sourceType: "official_production_record",
  role: "official_production_record" as const,
  editorialNote:
    "Hamilton identifies the vintage models sourced with the production and names the character assigned to each.",
};

const brandoSource = {
  id: 6,
  url: "https://www.phillips.com/detail/rolex/130499",
  title: "Marlon Brando Apocalypse Now Rolex GMT-Master",
  publisher: "Phillips",
  sourceType: "auction_catalogue_with_provenance",
  role: "other" as const,
  editorialNote:
    "The auction catalogue records reference 1675, Brando-family provenance, ownership, and the same watch's use in Apocalypse Now.",
};

const stories: StorySeed[] = [
  {
    id: 1,
    slug: "murph-cooper-interstellar-hamilton",
    headline: "The watch that carries Interstellar's message",
    summary:
      "Hamilton created a one-off prop for Interstellar; the later retail Khaki Field Murph recreates it but is not treated as the same exact reference.",
    entityKind: "fictional_character",
    displayName: "Murphy “Murph” Cooper",
    disambiguation:
      "Interstellar character portrayed as an adult by Jessica Chastain",
    work: {
      kind: "film",
      title: "Interstellar",
      slug: "interstellar-2014",
      releaseDate: "2014-11-07",
    },
    claimType: "screen_worn",
    precision: "model_family",
    brand: "Hamilton",
    model: "Khaki Field Murph film prop",
    confidence: "family_only",
    sceneLocator: "The watch is used to decode Cooper's Morse-code message.",
    editorialNote:
      "The production prop predates the commercial 42 mm and 38 mm references, so no retail reference code is assigned.",
    source: {
      id: 1,
      url: "https://www.hamiltonwatch.com/en-int/making-the-khaki-field-murph",
      title: "Khaki Field Murph Movie Watch",
      publisher: "Hamilton",
      sourceType: "official_production_record",
      role: "official_production_record",
      publishedAt: "2019-02-06T00:00:00.000Z",
      editorialNote:
        "Hamilton states that it worked with the director and production designer to create the film watch and distinguishes the later retail recreation.",
    },
  },
  {
    id: 2,
    slug: "the-protagonist-tenet-hamilton",
    headline: "TENET's purpose-built countdown watch",
    summary:
      "The production used a custom Hamilton prop based on the Khaki Navy BeLOWZERO, not the inspired-by retail limited edition.",
    entityKind: "fictional_character",
    displayName: "The Protagonist",
    disambiguation: "TENET character portrayed by John David Washington",
    work: {
      kind: "film",
      title: "TENET",
      slug: "tenet-2020",
      releaseDate: "2020-08-26",
    },
    claimType: "screen_worn",
    precision: "model_family",
    brand: "Hamilton",
    model: "Khaki Navy BeLOWZERO custom film prop",
    confidence: "family_only",
    editorialNote:
      "Hamilton says the prop had functions unavailable in a commercial watch; the retail red/blue editions are not claimed as screen-worn.",
    source: {
      id: 2,
      url: "https://www.hamiltonwatch.com/no-no/tenet",
      title: "Hamilton: Official Watch of TENET",
      publisher: "Hamilton",
      sourceType: "official_production_record",
      role: "official_production_record",
      editorialNote:
        "Hamilton documents the custom prop development and identifies BeLOWZERO only as its base.",
    },
  },
  {
    id: 3,
    slug: "paul-atreides-dune-part-two-desert-watch",
    headline: "The Fremen device built for Dune: Part Two",
    summary:
      "Hamilton and the prop department created the non-commercial Desert Watch for the Fremen; retail Ventura editions are only design derivatives.",
    entityKind: "fictional_character",
    displayName: "Paul Atreides",
    disambiguation: "Dune character portrayed by Timothée Chalamet",
    work: {
      kind: "film",
      title: "Dune: Part Two",
      slug: "dune-part-two-2024",
      releaseDate: "2024-03-01",
    },
    claimType: "screen_worn",
    precision: "model_family",
    brand: "Hamilton",
    model: "Desert Watch custom prop",
    confidence: "family_only",
    editorialNote:
      "The official record calls the prop available only on Arrakis; no Ventura retail reference is substituted for it.",
    source: {
      id: 3,
      url: "https://www.hamiltonwatch.com/en-ca/dunemovie-watches",
      title: "Hamilton x Dune: Part Two",
      publisher: "Hamilton",
      sourceType: "official_production_record",
      role: "official_production_record",
      editorialNote:
        "Hamilton credits prop master Doug Harlocker and separates the screen device from the inspired retail watches.",
    },
  },
  {
    id: 4,
    slug: "j-robert-oppenheimer-cushion-b",
    headline: "A 1930s Hamilton selected for Oppenheimer",
    summary:
      "The production's sourced period watches include a Hamilton Cushion B worn by the J. Robert Oppenheimer character.",
    entityKind: "fictional_character",
    displayName: "J. Robert Oppenheimer",
    disambiguation: "Oppenheimer character portrayed by Cillian Murphy",
    work: {
      kind: "film",
      title: "Oppenheimer",
      slug: "oppenheimer-2023-cushion-b",
      releaseDate: "2023-07-21",
    },
    claimType: "screen_worn",
    precision: "model_family",
    brand: "Hamilton",
    model: "Cushion B (1930s)",
    confidence: "family_only",
    editorialNote:
      "The official record names the model and decade but does not provide a reference or case number.",
    source: oppenheimerSource,
  },
  {
    id: 5,
    slug: "kitty-oppenheimer-lady-hamilton-a2",
    headline: "Kitty Oppenheimer's 1947 Lady Hamilton",
    summary:
      "Hamilton identifies the ornate Lady Hamilton A-2 selected for Kitty Oppenheimer's on-screen wardrobe.",
    entityKind: "fictional_character",
    displayName: "Kitty Oppenheimer",
    disambiguation: "Oppenheimer character portrayed by Emily Blunt",
    work: {
      kind: "film",
      title: "Oppenheimer",
      slug: "oppenheimer-2023-lady-hamilton",
      releaseDate: "2023-07-21",
    },
    claimType: "screen_worn",
    precision: "model_family",
    brand: "Hamilton",
    model: "Lady Hamilton A-2 (1947)",
    confidence: "family_only",
    editorialNote:
      "The model and year are official, while a case or movement reference remains unstated.",
    source: oppenheimerSource,
  },
  {
    id: 6,
    slug: "leslie-groves-oppenheimer-piping-rock",
    headline: "General Groves's period-correct Piping Rock",
    summary:
      "Hamilton records a 1920s Piping Rock among the watches assigned to Lieutenant General Leslie Groves in Oppenheimer.",
    entityKind: "fictional_character",
    displayName: "Lieutenant General Leslie Groves",
    disambiguation: "Oppenheimer character portrayed by Matt Damon",
    work: {
      kind: "film",
      title: "Oppenheimer",
      slug: "oppenheimer-2023-piping-rock",
      releaseDate: "2023-07-21",
    },
    claimType: "screen_worn",
    precision: "model_family",
    brand: "Hamilton",
    model: "Piping Rock (1920s)",
    confidence: "family_only",
    editorialNote:
      "The production also used a black service watch for Groves; this card makes only the bounded Piping Rock claim.",
    source: oppenheimerSource,
  },
  {
    id: 7,
    slug: "james-bond-no-time-to-die-seamaster",
    headline: "Bond's titanium Seamaster in No Time to Die",
    summary:
      "OMEGA identifies an authentic Seamaster Diver 300M 007 Edition prop from Daniel Craig's final Bond film.",
    entityKind: "fictional_character",
    displayName: "James Bond",
    disambiguation: "No Time to Die character portrayed by Daniel Craig",
    work: {
      kind: "film",
      title: "No Time to Die",
      slug: "no-time-to-die-2021",
      releaseDate: "2021-09-30",
    },
    claimType: "screen_worn",
    precision: "model_family",
    brand: "OMEGA",
    model: "Seamaster Diver 300M 007 Edition",
    confidence: "family_only",
    editorialNote:
      "The official exhibition record establishes the edition and prop status but does not publish a reference code on the cited page.",
    source: {
      id: 5,
      url: "https://press.omegawatches.com/the-planet-omega-exhibition-opens-in-new-york-city/",
      title: "The Planet OMEGA Exhibition Opens in New York City",
      publisher: "OMEGA",
      sourceType: "official_museum_exhibition_record",
      role: "official_production_record",
      editorialNote:
        "OMEGA describes the displayed piece as an authentic film prop from No Time to Die and identifies its edition and titanium construction.",
    },
  },
  {
    id: 8,
    slug: "colonel-kurtz-apocalypse-now-rolex",
    headline: "The bezel-less GMT-Master worn by Colonel Kurtz",
    summary:
      "Phillips documents Marlon Brando's Rolex GMT-Master ref. 1675 as the exact watch seen on Colonel Kurtz in Apocalypse Now.",
    entityKind: "fictional_character",
    displayName: "Colonel Walter E. Kurtz",
    disambiguation: "Apocalypse Now character portrayed by Marlon Brando",
    work: {
      kind: "film",
      title: "Apocalypse Now",
      slug: "apocalypse-now-1979",
      releaseDate: "1979-08-15",
    },
    claimType: "screen_worn",
    precision: "exact_reference",
    brand: "Rolex",
    model: "GMT-Master",
    reference: "1675",
    confidence: "confirmed",
    sceneLocator: "Worn without its bezel on Colonel Kurtz's wrist.",
    editorialNote:
      "The auction lot includes signed provenance letters and records the actor's hand-engraved caseback.",
    source: brandoSource,
  },
  {
    id: 9,
    slug: "agent-j-men-in-black-ventura",
    headline: "Agent J's original Men in Black Ventura",
    summary:
      "Hamilton identifies a Ventura on Agent J in the first Men in Black film and distinguishes later sequel configurations.",
    entityKind: "fictional_character",
    displayName: "Agent J",
    disambiguation: "Men in Black character portrayed by Will Smith",
    work: {
      kind: "film",
      title: "Men in Black",
      slug: "men-in-black-1997",
      releaseDate: "1997-07-02",
    },
    claimType: "screen_worn",
    precision: "model_family",
    brand: "Hamilton",
    model: "Ventura",
    confidence: "family_only",
    editorialNote:
      "No exact production reference is asserted; later Ventura Chrono and modified light-up props are separate claims.",
    source: {
      id: 7,
      url: "https://www.hamiltonwatch.com/en-my/company/hamilton-cinema",
      title: "The Watchmaker of Filmmakers",
      publisher: "Hamilton",
      sourceType: "official_production_history",
      role: "official_production_record",
      editorialNote:
        "Hamilton identifies Agent J and Agent K as Ventura wearers in the 1997 film.",
    },
  },
  {
    id: 10,
    slug: "indiana-jones-dial-of-destiny-boulton",
    headline: "Indiana Jones's Hamilton Boulton",
    summary:
      "Hamilton's product record identifies reference H13431553 as featured in Indiana Jones and the Dial of Destiny.",
    entityKind: "fictional_character",
    displayName: "Indiana Jones",
    disambiguation:
      "Indiana Jones and the Dial of Destiny character portrayed by Harrison Ford",
    work: {
      kind: "film",
      title: "Indiana Jones and the Dial of Destiny",
      slug: "indiana-jones-dial-of-destiny-2023",
      releaseDate: "2023-06-30",
    },
    claimType: "screen_worn",
    precision: "exact_reference",
    brand: "Hamilton",
    model: "American Classic Boulton Quartz",
    reference: "H13431553",
    confidence: "confirmed",
    editorialNote:
      "This is an exact product-page attribution; it remains discovery context and is not linked into the recommendation catalogue.",
    source: {
      id: 8,
      url: "https://www.hamiltonwatch.com/en-sa/h13431553-boulton-quartz.html",
      title: "American Classic Boulton Quartz H13431553",
      publisher: "Hamilton",
      sourceType: "official_product_and_production_record",
      role: "official_production_record",
      editorialNote:
        "The exact-reference product page explicitly says the watch was featured in the 2023 film.",
    },
  },
  {
    id: 11,
    slug: "don-draper-mad-men-omega",
    headline: "Don Draper's black-dial Seamaster De Ville",
    summary:
      "A Christie's lot with property-master authentication identifies the Omega ref. 166.020 worn by Don Draper from season five.",
    entityKind: "fictional_character",
    displayName: "Don Draper",
    disambiguation: "Mad Men character portrayed by Jon Hamm",
    work: {
      kind: "television_series",
      title: "Mad Men",
      slug: "mad-men-don-draper",
      releaseDate: "2007-07-19",
    },
    claimType: "screen_worn",
    precision: "exact_reference",
    brand: "OMEGA",
    model: "Seamaster De Ville",
    reference: "166.020",
    confidence: "confirmed",
    sceneLocator: "Main watch worn from season five.",
    editorialNote:
      "The auction notes that the dial was repainted before production and distinguishes an unworn spare.",
    source: {
      id: 9,
      url: "https://www.christies.com/lot/lot-5967746",
      title: "Omega ref. 166.020 worn on Mad Men",
      publisher: "Christie's",
      sourceType: "auction_catalogue_with_property_master_provenance",
      role: "official_production_record",
      editorialNote:
        "The lot is accompanied by authenticity letters from supplier Derek Dier and Mad Men property master Ellen Freund.",
    },
  },
  {
    id: 12,
    slug: "roger-sterling-mad-men-tudor",
    headline: "Roger Sterling's Tudor Oyster-Prince",
    summary:
      "Christie's identifies Tudor ref. 7967 as the watch selected by the Mad Men property master and worn by Roger Sterling.",
    entityKind: "fictional_character",
    displayName: "Roger Sterling",
    disambiguation: "Mad Men character portrayed by John Slattery",
    work: {
      kind: "television_series",
      title: "Mad Men",
      slug: "mad-men-roger-sterling",
      releaseDate: "2007-07-19",
    },
    claimType: "screen_worn",
    precision: "exact_reference",
    brand: "Tudor",
    model: "Oyster-Prince Rotor Self-Winding",
    reference: "7967",
    confidence: "confirmed",
    editorialNote:
      "The exact watch carries supplier and property-master provenance rather than a visual-only identification.",
    source: {
      id: 10,
      url: "https://www.christies.com/en/lot/lot-5967745",
      title: "Tudor ref. 7967 worn on Mad Men",
      publisher: "Christie's",
      sourceType: "auction_catalogue_with_property_master_provenance",
      role: "official_production_record",
      editorialNote:
        "The catalogue records the exact reference, wearer, and signed authenticity letters.",
    },
  },
  {
    id: 13,
    slug: "annie-edison-community-unidentified-watch",
    headline: "Annie Edison's recurring Community watch",
    summary:
      "Propstore confirms that Annie wore the auctioned watch throughout Community, but the record does not identify a brand or model.",
    entityKind: "fictional_character",
    displayName: "Annie Edison",
    disambiguation: "Community character portrayed by Alison Brie",
    work: {
      kind: "television_series",
      title: "Community",
      slug: "community-annie-edison",
      releaseDate: "2009-09-17",
    },
    claimType: "screen_worn",
    precision: "unidentified",
    confidence: "unconfirmed",
    sceneLocator: "Various episodes and seasons.",
    editorialNote:
      "The screen-worn object is supported, while its maker and model remain intentionally unidentified.",
    source: {
      id: 11,
      url: "https://us.propstoreauction.com/view-auctions/catalog/id/89/lot/17735/index.html",
      title: "Various Episodes: Annie Edison's Watch",
      publisher: "Propstore",
      sourceType: "production_prop_auction_record",
      role: "official_production_record",
      editorialNote:
        "The production-prop record establishes recurring screen use but supplies only materials and dimensions, not an identity.",
    },
  },
  {
    id: 14,
    slug: "paul-newman-rolex-daytona-6239",
    headline: "Paul Newman's own reference 6239 Daytona",
    summary:
      "Phillips records the Rolex Cosmograph Daytona ref. 6239 gifted by Joanne Woodward and worn by Paul Newman for years.",
    entityKind: "public_figure",
    displayName: "Paul Newman",
    claimType: "owned",
    precision: "exact_reference",
    brand: "Rolex",
    model: "Cosmograph Daytona ‘Paul Newman’",
    reference: "6239",
    confidence: "confirmed",
    editorialNote:
      "The claim is ownership and personal wear, distinct from any character or film attribution.",
    source: {
      id: 12,
      url: "https://www.phillips.com/detail/rolex/100049",
      title: "Paul Newman's Rolex Cosmograph Daytona ref. 6239",
      publisher: "Phillips",
      sourceType: "auction_catalogue_with_family_provenance",
      role: "other",
      editorialNote:
        "The lot records the gift, case number, engraving, family attestation, and Newman's long personal use.",
    },
  },
  {
    id: 15,
    slug: "jack-nicklaus-rolex-day-date-1803",
    headline: "The Day-Date Jack Nicklaus wore for five decades",
    summary:
      "Phillips documents the Rolex Day-Date ref. 1803 that Jack Nicklaus wore through most of his professional victories.",
    entityKind: "public_figure",
    displayName: "Jack Nicklaus",
    claimType: "worn_publicly",
    precision: "exact_reference",
    brand: "Rolex",
    model: "Day-Date",
    reference: "1803",
    confidence: "confirmed",
    editorialNote:
      "The source supports repeated public wear, not one inferred event, and records the watch as his first.",
    source: {
      id: 13,
      url: "https://www.phillips.com/detail/NY080119/18",
      title: "Jack Nicklaus Rolex Day-Date ref. 1803",
      publisher: "Phillips",
      sourceType: "auction_catalogue_with_owner_provenance",
      role: "other",
      editorialNote:
        "The catalogue records Nicklaus's account and decades of photographed tournament wear.",
    },
  },
  {
    id: 16,
    slug: "eric-clapton-patek-philippe-2499-100",
    headline: "Eric Clapton's platinum Patek Philippe 2499/100",
    summary:
      "Christie's sale record identifies a platinum Patek Philippe ref. 2499/100 offered from Eric Clapton's collection.",
    entityKind: "public_figure",
    displayName: "Eric Clapton",
    claimType: "owned",
    precision: "exact_reference",
    brand: "Patek Philippe",
    model: "Perpetual Calendar Chronograph",
    reference: "2499/100",
    confidence: "confirmed",
    editorialNote:
      "The claim is limited to collection ownership; no specific public-wear occasion is inferred.",
    source: {
      id: 14,
      url: "https://www.christies.com/auction/auction-1391-gnv",
      title: "Important Watches, A Gentleman's Pursuit for Excellence, Part I",
      publisher: "Christie's",
      sourceType: "auction_sale_record",
      role: "other",
      editorialNote:
        "Christie's names the exact reference and states that it was offered from Clapton's collection.",
    },
  },
  {
    id: 17,
    slug: "wally-schirra-omega-ck-2998",
    headline: "Wally Schirra's personal CK 2998 in orbit",
    summary:
      "OMEGA records that astronaut Wally Schirra bought a Speedmaster CK 2998 and wore it on the Sigma 7 mission.",
    entityKind: "public_figure",
    displayName: "Walter “Wally” Schirra",
    event: {
      kind: "other",
      title: "Mercury-Atlas 8 / Sigma 7 mission",
      slug: "sigma-7-mission-1962",
      occurredOn: "1962-10-03",
      location: "Earth orbit",
    },
    claimType: "worn_publicly",
    precision: "exact_reference",
    brand: "OMEGA",
    model: "Speedmaster",
    reference: "CK 2998",
    confidence: "confirmed",
    observedOn: "1962-10-03",
    editorialNote:
      "This was Schirra's personal watch and predates NASA's later formal Speedmaster qualification.",
    source: {
      id: 15,
      url: "https://press.omegawatches.com/the-first-omega-in-space-makes-a-vintage-return/",
      title: "The First OMEGA in Space Makes a Vintage Return",
      publisher: "OMEGA",
      sourceType: "official_brand_history",
      role: "other",
      publishedAt: "2024-10-03T00:00:00.000Z",
      editorialNote:
        "OMEGA identifies CK 2998, Schirra's personal purchase, and the mission date.",
    },
  },
  {
    id: 18,
    slug: "aaron-taylor-johnson-omega-first-in-space",
    headline: "Aaron Taylor-Johnson's First OMEGA in Space",
    summary:
      "OMEGA's ambassador announcement records Taylor-Johnson wearing exact reference 310.32.40.50.06.002 at its Swiss headquarters.",
    entityKind: "public_figure",
    displayName: "Aaron Taylor-Johnson",
    event: {
      kind: "public_appearance",
      title: "OMEGA headquarters visit",
      slug: "aaron-taylor-johnson-omega-hq-visit",
      occurredOn: null,
      location: "Biel/Bienne, Switzerland",
    },
    claimType: "worn_publicly",
    precision: "exact_reference",
    brand: "OMEGA",
    model: "Speedmaster First OMEGA in Space",
    reference: "310.32.40.50.06.002",
    confidence: "confirmed",
    editorialNote:
      "This is a disclosed ambassador appearance, not an implication of unpaid preference or ownership.",
    source: {
      id: 16,
      url: "https://press.omegawatches.com/aaron-taylor-johnson-joins-omega-as-a-brand-ambassador/",
      title: "Aaron Taylor-Johnson Joins OMEGA as a Brand Ambassador",
      publisher: "OMEGA",
      sourceType: "official_event_and_partnership_record",
      role: "other",
      editorialNote:
        "OMEGA supplies the exact reference and event context while disclosing the commercial relationship.",
    },
  },
  {
    id: 19,
    slug: "marlon-brando-rolex-gmt-master-1675",
    headline: "Marlon Brando's hand-engraved GMT-Master",
    summary:
      "Phillips traces Brando's ownership of Rolex ref. 1675 before he passed it to his daughter in 1995.",
    entityKind: "public_figure",
    displayName: "Marlon Brando",
    claimType: "owned",
    precision: "exact_reference",
    brand: "Rolex",
    model: "GMT-Master",
    reference: "1675",
    confidence: "confirmed",
    editorialNote:
      "This ownership claim is intentionally separate from the Colonel Kurtz screen-worn attribution.",
    source: brandoSource,
  },
  {
    id: 20,
    slug: "rafael-nadal-richard-mille-rm-27-04",
    headline: "The RM 27-04 built for Rafael Nadal's matches",
    summary:
      "Richard Mille identifies the RM 27-04 as a 50-piece tourbillon made for Nadal and worn in the brand's court programme.",
    entityKind: "public_figure",
    displayName: "Rafael Nadal",
    claimType: "worn_publicly",
    precision: "exact_reference",
    brand: "Richard Mille",
    model: "Manual Winding Tourbillon Rafael Nadal",
    reference: "RM 27-04",
    confidence: "confirmed",
    editorialNote:
      "The record is an official partnership source; the commercial relationship is material context and must remain visible.",
    source: {
      id: 17,
      url: "https://www.richardmille.com/historical-models/rm-27-04-tourbillon",
      title: "RM 27-04 Manual Winding Tourbillon Rafael Nadal",
      publisher: "Richard Mille",
      sourceType: "official_product_and_partnership_record",
      role: "other",
      editorialNote:
        "Richard Mille identifies the exact model, partnership, limited production, and watches designed for Nadal's court use.",
    },
  },
  {
    id: 21,
    slug: "lewis-hamilton-silverstone-iwc-iw388306",
    headline: "Lewis Hamilton's Silverstone podium chronograph",
    summary:
      "IWC identifies ref. IW388306 as the exact watch Hamilton wore while celebrating his ninth British Grand Prix victory.",
    entityKind: "public_figure",
    displayName: "Lewis Hamilton",
    event: {
      kind: "sporting_event",
      title: "2024 British Grand Prix podium",
      slug: "british-grand-prix-podium-2024",
      occurredOn: "2024-07-07",
      location: "Silverstone Circuit, England",
    },
    claimType: "worn_publicly",
    precision: "exact_reference",
    brand: "IWC Schaffhausen",
    model:
      "Pilot's Watch Performance Chronograph 41 Mercedes-AMG PETRONAS Formula One Team",
    reference: "IW388306",
    confidence: "confirmed",
    observedOn: "2024-07-07",
    editorialNote:
      "The watch was later offered in a charity auction; IWC's partnership with Hamilton is disclosed context.",
    source: {
      id: 18,
      url: "https://press.iwc.com/iwc-chronograph-worn-by-lewis-hamilton-on-podium-auction-laureus-en/",
      title:
        "The IWC Chronograph Worn by Lewis Hamilton on the Silverstone Podium",
      publisher: "IWC Schaffhausen",
      sourceType: "official_event_and_auction_record",
      role: "other",
      publishedAt: "2024-10-09T00:00:00.000Z",
      editorialNote:
        "IWC names the exact watch, the podium occasion, and its subsequent charity-auction provenance.",
    },
  },
];

export const DISCOVERY_PILOT_CORPUS = {
  version: 1,
  reviewedAt,
  stories: stories.map(buildStory),
} satisfies DiscoveryPilotCorpus;

import { z } from "zod";

import {
  AESTHETIC_DNA,
  DEPLOYMENT_ENVIRONMENTS,
  SOCIAL_SIGNALS,
} from "./questionnaire";

export const PRICE_COMFORTS = [
  "considered_entry",
  "established_collection",
  "exceptional_object",
] as const;

export const ARCHETYPE_IDS = [
  "field_rationalist",
  "quiet_custodian",
  "architectural_modernist",
  "expressive_collector",
] as const;

const answersSchema = z
  .object({
    socialSignal: z.enum(SOCIAL_SIGNALS),
    aestheticDna: z.enum(AESTHETIC_DNA),
    deploymentEnvironment: z.enum(DEPLOYMENT_ENVIRONMENTS),
    priceComfort: z.enum(PRICE_COMFORTS),
  })
  .strict();

const coreQuizHandoffSchema = z
  .object({
    socialSignal: z.enum(SOCIAL_SIGNALS),
    aestheticDna: z.enum(AESTHETIC_DNA),
  })
  .strict();

export type ArchetypeAnswers = z.infer<typeof answersSchema>;
export type CoreQuizHandoff = z.infer<typeof coreQuizHandoffSchema>;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];

export type Archetype = {
  id: ArchetypeId;
  title: string;
  strapline: string;
  description: string;
  accent: string;
};

export const ARCHETYPES: Record<ArchetypeId, Archetype> = {
  field_rationalist: {
    id: "field_rationalist",
    title: "The Field Rationalist",
    strapline: "Utility first. Mythology only when it earns its keep.",
    description:
      "You lean toward legible, resilient watches whose form explains their purpose. Recognition matters less than competence under real use.",
    accent: "Instrument green",
  },
  quiet_custodian: {
    id: "quiet_custodian",
    title: "The Quiet Custodian",
    strapline: "Continuity without theatre.",
    description:
      "You favour restrained objects with enough history to reward attention over time. The watch should age into a record, not announce its invoice.",
    accent: "Archive parchment",
  },
  architectural_modernist: {
    id: "architectural_modernist",
    title: "The Architectural Modernist",
    strapline: "Proportion is the complication.",
    description:
      "You respond to deliberate geometry, controlled surfaces, and watches that hold their own in formal or designed environments.",
    accent: "Oxidised brass",
  },
  expressive_collector: {
    id: "expressive_collector",
    title: "The Expressive Collector",
    strapline: "An object can be rigorous and still refuse anonymity.",
    description:
      "You leave room for visual risk, rare craft, and watches with a strong point of view. Character is useful; empty spectacle is not.",
    accent: "Signal red",
  },
};

export const ARCHETYPE_QUESTIONS = [
  {
    name: "socialSignal",
    legend: "What should the watch communicate?",
    options: [
      ["discreet_competence", "Competence, mainly to those who notice"],
      ["quiet_continuity", "Continuity and restraint"],
      ["unapologetic_benchmark", "A clear benchmark of achievement"],
      ["anti_luxury", "Utility, with little interest in luxury codes"],
    ],
  },
  {
    name: "aestheticDna",
    legend: "Which visual language feels most natural?",
    options: [
      ["structural_tool", "Visible purpose and protection"],
      ["mid_century_industrial", "Restrained mid-century instruments"],
      ["integrated_geometry", "Architectural case and bracelet geometry"],
      ["extravagant_creative", "Sculptural, unconventional form"],
      ["high_art", "Fine finishing and traditional handcraft"],
    ],
  },
  {
    name: "deploymentEnvironment",
    legend: "Where does it need to make sense?",
    options: [
      ["field_water_abuse", "Field, water, travel, or hard use"],
      ["studio_desk_daily", "Studio, desk, and daily wear"],
      ["formal_architectural", "Formal or architectural settings"],
    ],
  },
  {
    name: "priceComfort",
    legend: "At this early stage, which price idea feels plausible?",
    hint: "This is directional only. The full diagnostic still requires an exact maximum budget.",
    options: [
      ["considered_entry", "A considered first serious watch"],
      ["established_collection", "An established collection purchase"],
      ["exceptional_object", "An exceptional object, if justified"],
    ],
  },
] as const;

const SCORE_MAP: Record<string, ArchetypeId> = {
  discreet_competence: "architectural_modernist",
  quiet_continuity: "quiet_custodian",
  unapologetic_benchmark: "expressive_collector",
  anti_luxury: "field_rationalist",
  structural_tool: "field_rationalist",
  mid_century_industrial: "quiet_custodian",
  integrated_geometry: "architectural_modernist",
  extravagant_creative: "expressive_collector",
  high_art: "expressive_collector",
  field_water_abuse: "field_rationalist",
  studio_desk_daily: "quiet_custodian",
  formal_architectural: "architectural_modernist",
  considered_entry: "field_rationalist",
  established_collection: "quiet_custodian",
  exceptional_object: "expressive_collector",
};

export type ArchetypeParseResult =
  | { status: "idle" }
  | { status: "invalid" }
  | { status: "complete"; answers: ArchetypeAnswers; archetype: Archetype };

const answerFields = [
  "socialSignal",
  "aestheticDna",
  "deploymentEnvironment",
  "priceComfort",
] as const;

export function parseArchetypeSearch(
  search: URLSearchParams,
): ArchetypeParseResult {
  if (!answerFields.some((field) => search.has(field)))
    return { status: "idle" };

  const parsed = answersSchema.safeParse(
    Object.fromEntries(answerFields.map((field) => [field, search.get(field)])),
  );
  if (!parsed.success) return { status: "invalid" };

  return {
    status: "complete",
    answers: parsed.data,
    archetype: scoreArchetype(parsed.data),
  };
}

export function scoreArchetype(answers: ArchetypeAnswers): Archetype {
  const scores = Object.fromEntries(
    ARCHETYPE_IDS.map((id) => [id, 0]),
  ) as Record<ArchetypeId, number>;

  for (const answer of Object.values(answers)) {
    const archetypeId = SCORE_MAP[answer];
    if (archetypeId) scores[archetypeId] += 1;
  }

  const winner = ARCHETYPE_IDS.reduce((best, candidate) =>
    scores[candidate] > scores[best] ? candidate : best,
  );
  return ARCHETYPES[winner];
}

export function buildArchetypeSharePath(answers: ArchetypeAnswers) {
  return `/watches/archetype?${new URLSearchParams(answers).toString()}`;
}

export function buildCoreQuizHandoff(answers: ArchetypeAnswers) {
  return `/quiz?${new URLSearchParams({
    source: "archetype",
    socialSignal: answers.socialSignal,
    aestheticDna: answers.aestheticDna,
  }).toString()}`;
}

export function parseCoreQuizHandoff(search: URLSearchParams) {
  if (search.get("source") !== "archetype") return null;
  const parsed = coreQuizHandoffSchema.safeParse({
    socialSignal: search.get("socialSignal"),
    aestheticDna: search.get("aestheticDna"),
  });
  return parsed.success ? parsed.data : null;
}

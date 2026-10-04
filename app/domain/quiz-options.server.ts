/**
 * The diagnostic's choices that come from the catalogue vocabulary: where
 * the watch is worn, and the functions it can require. Shared by /quiz, its
 * partner widget and the public API.
 */
import type { VocabularyKind } from "./catalogue-vocabulary";
import { loadCatalogueVocabulary } from "./catalogue-vocabulary.server";

export type VocabularyOption = { slug: string; labelEn: string };

const QUIZ_SCENARIOS: VocabularyOption[] = [
  { slug: "everyday", labelEn: "Everyday" },
  { slug: "office", labelEn: "Office & business" },
  { slug: "suit", labelEn: "Suit & formal evenings" },
  { slug: "sport", labelEn: "Sport & weekends" },
  { slug: "diving", labelEn: "Diving & water" },
  { slug: "field", labelEn: "Outdoors & expeditions" },
  { slug: "travel", labelEn: "Travel & flights" },
];

export async function loadQuizOptions() {
  const vocabulary = await loadCatalogueVocabulary();
  const options = (kind: VocabularyKind): VocabularyOption[] =>
    vocabulary
      .filter((row) => row.kind === kind && row.active)
      .map((row) => ({ slug: row.slug, labelEn: row.labelEn }));

  // Seven plain choices instead of the vocabulary's 44: together they cover
  // every catalogue style (owner decision, 2026-10-01).
  const scenarioSlugs = new Set(
    options("wearing_scenario").map((option) => option.slug),
  );
  return {
    scenarios: QUIZ_SCENARIOS.filter((option) =>
      scenarioSlugs.has(option.slug),
    ),
    complications: options("complication"),
  };
}

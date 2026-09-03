import { describe, expect, it } from "vitest";

import {
  BUNDLED_VOCABULARY,
  normalizeSourceToken,
  resolveVocabularySlug,
  splitComplicationTokens,
  splitScenarioTokens,
  vocabularyRowSchema,
  VOCABULARY_KINDS,
} from "./catalogue-vocabulary";

describe("bundled vocabulary", () => {
  it("parses every bundled row", () => {
    for (const row of BUNDLED_VOCABULARY) {
      expect(vocabularyRowSchema.parse(row)).toEqual(row);
    }
  });

  it("keeps slugs unique within a kind", () => {
    for (const kind of VOCABULARY_KINDS) {
      const slugs = BUNDLED_VOCABULARY.filter((row) => row.kind === kind).map(
        (row) => row.slug,
      );
      expect(new Set(slugs).size).toBe(slugs.length);
    }
  });

  it("never maps one source alias to two slugs of the same kind", () => {
    for (const kind of VOCABULARY_KINDS) {
      const aliases = BUNDLED_VOCABULARY.filter(
        (row) => row.kind === kind,
      ).flatMap((row) => row.sourceAliases.map(normalizeSourceToken));
      expect(new Set(aliases).size).toBe(aliases.length);
    }
  });

  it("covers all three kinds", () => {
    for (const kind of VOCABULARY_KINDS) {
      expect(BUNDLED_VOCABULARY.some((row) => row.kind === kind)).toBe(true);
    }
  });
});

describe("normalizeSourceToken", () => {
  it("lowercases, trims, and collapses whitespace", () => {
    expect(normalizeSourceToken("  Смарт   Casual ")).toBe("смарт casual");
  });

  it("normalizes unicode width and case", () => {
    expect(normalizeSourceToken("ОФИС")).toBe("офис");
  });
});

describe("resolveVocabularySlug", () => {
  it("resolves a known Russian scenario alias", () => {
    expect(resolveVocabularySlug("wearing_scenario", "офис")).toBe("office");
  });

  it("resolves case- and space-insensitively", () => {
    expect(resolveVocabularySlug("wearing_scenario", "  Дайвинг ")).toBe(
      "diving",
    );
  });

  it("returns null for an unmapped token", () => {
    expect(resolveVocabularySlug("wearing_scenario", "марсоход")).toBeNull();
  });

  it("does not resolve a token belonging to another kind", () => {
    expect(resolveVocabularySlug("complication", "офис")).toBeNull();
  });

  it("resolves complications including the time-only marker", () => {
    expect(resolveVocabularySlug("complication", "нет (Time-only)")).toBe(
      "time_only",
    );
    expect(resolveVocabularySlug("complication", "хронограф")).toBe(
      "chronograph",
    );
  });
});

describe("token splitting", () => {
  it("splits scenarios on slashes", () => {
    expect(splitScenarioTokens("офис / спорт-шик / smart casual")).toEqual([
      "офис",
      "спорт-шик",
      "smart casual",
    ]);
  });

  it("splits complications on commas", () => {
    expect(
      splitComplicationTokens("дата, второй пояс GMT, безель 24ч"),
    ).toEqual(["дата", "второй пояс GMT", "безель 24ч"]);
  });

  it("drops empty segments", () => {
    expect(splitScenarioTokens("офис //  / вечер")).toEqual(["офис", "вечер"]);
  });
});

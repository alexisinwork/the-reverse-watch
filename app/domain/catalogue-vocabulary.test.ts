import { describe, expect, it } from "vitest";

import {
  BUNDLED_VOCABULARY,
  normalizeSourceToken,
  positioningMapForTest,
  resolvePositioningGroup,
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

describe("resolvePositioningGroup", () => {
  it("maps an avant-garde phrase", () => {
    expect(
      resolvePositioningGroup("авангардный флагман с открытым калибром"),
    ).toBe("avant_garde");
  });

  it("maps a neoclassical phrase", () => {
    expect(resolvePositioningGroup("современная неоклассика")).toBe(
      "quiet_classic",
    );
  });

  it("maps a platinum Ice Blue phrase", () => {
    expect(resolvePositioningGroup("ультимативная платина Ice Blue")).toBe(
      "platinum_ice",
    );
  });

  it("maps an instrument phrase", () => {
    expect(resolvePositioningGroup("эталонный инструмент")).toBe("instrument");
  });

  it("is whitespace and case insensitive", () => {
    expect(resolvePositioningGroup("  Тихая   Классика ")).toBe(
      "quiet_classic",
    );
  });

  it("returns null for an unmapped phrase", () => {
    expect(resolvePositioningGroup("никогда не встречалось")).toBeNull();
  });

  it("only ever returns a known positioning group slug", () => {
    const groups = new Set(
      BUNDLED_VOCABULARY.filter((row) => row.kind === "positioning_group").map(
        (row) => row.slug,
      ),
    );
    const mapped = Object.values(positioningMapForTest);
    for (const slug of mapped) expect(groups.has(slug)).toBe(true);
  });

  it("has no two phrases that collapse to the same normalized key", () => {
    const keys = Object.keys(positioningMapForTest);
    const normalized = keys.map(normalizeSourceToken);
    expect(new Set(normalized).size).toBe(keys.length);
  });
});

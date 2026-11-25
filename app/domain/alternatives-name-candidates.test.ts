import { describe, expect, it } from "vitest";

import { normalizeReference } from "./ai-watch-guardrails";
import {
  foldName,
  nameCandidateQuery,
  resolveNamedWatch,
} from "./alternatives.server";
import { designTraitsSchema } from "./design-traits";
import type { NameFacts } from "./watch-catalogue";
import type { NameCandidateQuery } from "./watch-catalogue.server";

const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** private.watch_name_fold (migrations 0118–0119), mirrored: decompose,
 * then lowercase A–Z only. */
const databaseFold = (value: string) =>
  value.normalize("NFD").replace(/[A-Z]/g, (letter) => letter.toLowerCase());

/** private.watch_reference_key (migration 0118), mirrored. */
const databaseReferenceKey = (value: string) =>
  value
    .replace(/[A-ZKİ]/g, (letter) =>
      letter === "K" ? "k" : letter === "İ" ? "i" : letter.toLowerCase(),
    )
    .replace(/[^a-z0-9]/g, "");

const runs = (value: string) => value.match(/[a-z0-9]+/g) ?? [];

/** watch_catalogue_name_candidates_v2, mirrored for tests. The database
 * itself is checked by scripts/check-name-lookup-equivalence.ts. */
function isCandidate(row: NameFacts, query: NameCandidateQuery) {
  if (row.reviewStatus === "rejected") return false;
  if (
    query.referenceKey !== "" &&
    row.referenceCode !== null &&
    databaseReferenceKey(row.referenceCode) === query.referenceKey
  )
    return true;
  if (query.minHits <= 0) return false;
  const text = databaseFold(
    `${row.brand} ${row.model} ${row.referenceCode ?? ""}`,
  );
  if (!query.required.every((pattern) => new RegExp(pattern).test(text)))
    return false;
  return (
    query.terms.filter((term) => new RegExp(term).test(text)).length >=
    query.minHits
  );
}

/** A small deterministic random generator, so failures reproduce. */
function random(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function one<T>(next: () => number, values: readonly T[]): T {
  return values[Math.floor(next() * values.length)]!;
}

const BRANDS = [
  "Tudor",
  "Rolex",
  "Omega",
  "Glashütte Original",
  "Grand Seiko",
  "Patek Philippe",
  "Montblanc",
  "Seiko",
  "Œuvre",
  "Black Bay Co",
];
const MODEL_WORDS = [
  "Black",
  "Bay",
  "Fifty-Eight",
  "58",
  "Submariner",
  "Date",
  "Seamaster",
  "Diver",
  "300M",
  "Héritage",
  "Senator",
  "Nautilus",
  "Calatrava",
  "the",
  "Watch",
  "GMT",
  "Blue",
  "eight",
  "Spring-Drive",
  "KelvinK",
  "İstanbul",
];

function randomRow(next: () => number, index: number): NameFacts {
  const words = Array.from({ length: 1 + Math.floor(next() * 4) }, () =>
    one(next, MODEL_WORDS),
  );
  const reference =
    next() < 0.8
      ? `${one(next, ["M", "", "SBGA", "5711/", "IW"])}${Math.floor(next() * 900)}${one(next, ["", "-0001", ".1A", "K", " LN"])}`
      : null;
  return {
    id: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`,
    brand: one(next, BRANDS),
    model: words.join(" "),
    referenceCode: reference,
    referenceConfirmed: next() < 0.6,
    reviewStatus: one(next, ["pending", "approved", "approved", "rejected"]),
    styles:
      next() < 0.8 ? [one(next, ["dive", "sport", "dress"] as const)] : [],
    caseShape: next() < 0.2 ? "rectangular" : "round",
    caseDiameterMm: next() < 0.85 ? 36 + Math.floor(next() * 8) : null,
    movement: next() < 0.85 ? "automatic" : null,
    waterResistanceM: next() < 0.7 ? 300 : null,
    designTraits: next() < 0.5 ? designTraitsSchema.parse({}) : null,
  };
}

/** What a visitor might type for a row: its name, part of it, a word
 * swapped or dropped, other letter case, diacritics removed. */
function randomTyping(next: () => number, rows: NameFacts[]) {
  const row = one(next, rows);
  const parts = `${row.brand} ${row.model}`.split(" ");
  const choice = next();
  let name = parts.join(" ");
  if (choice < 0.2) name = parts.slice(1).join(" ");
  else if (choice < 0.4)
    name = parts
      .map((part, index) => (index === parts.length - 1 ? "Zzz" : part))
      .join(" ");
  else if (choice < 0.5) name = parts.slice(0, 2).join(" ");
  else if (choice < 0.6) name = name.toUpperCase();
  else if (choice < 0.7) name = name.normalize("NFD").replace(/[̀-ͯ]/g, "");
  else if (choice < 0.8) name = `${name} ${one(next, MODEL_WORDS)}`;
  else if (choice < 0.85) name = one(next, ["ab", "the watch", "  ", "%_\\"]);
  const reference =
    next() < 0.3
      ? next() < 0.7
        ? row.referenceCode
        : `X${Math.floor(next() * 900)}`
      : null;
  return { name, reference };
}

describe("database name fold (migration 0118)", () => {
  it("leaves the same letters and digits as the code's fold for every code point", () => {
    const differences: string[] = [];
    for (let point = 1; point <= 0x10ffff; point += 1) {
      if (point >= 0xd800 && point <= 0xdfff) continue;
      const character = String.fromCodePoint(point);
      if (
        runs(foldName(character)).join(" ") !==
        runs(databaseFold(character)).join(" ")
      )
        differences.push(point.toString(16));
    }
    expect(differences).toEqual([]);
  });

  it("gives the code's reference key for every code point", () => {
    // normalizeReference: lowercase, keep [a-z0-9], and at least three.
    const codeKey = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]/g, "");
    const differences: string[] = [];
    for (let point = 1; point <= 0x10ffff; point += 1) {
      if (point >= 0xd800 && point <= 0xdfff) continue;
      const character = String.fromCodePoint(point);
      if (codeKey(character) !== databaseReferenceKey(character))
        differences.push(point.toString(16));
    }
    expect(differences).toEqual([]);
    expect(databaseReferenceKey(`${UPPER}-Kİ 9`)).toBe(
      `${UPPER.toLowerCase()}ki9`,
    );
    expect(normalizeReference("M79030N-0001")).toBe("m79030n0001");
    expect(normalizeReference("A-1")).toBeNull();
  });
});

describe("nameCandidateQuery", () => {
  it("requires every word of a short name and lets one miss in a long one", () => {
    expect(nameCandidateQuery("Rolex Submariner", null)).toEqual({
      referenceKey: "",
      terms: ["rolex", "submariner"],
      minHits: 2,
      required: ["rolex", "submariner"],
    });
    expect(nameCandidateQuery("Tudor Black Bay 58", "M79030N-0001")).toEqual({
      referenceKey: "m79030n0001",
      terms: ["tudor", "black", "bay", "58|fifty"],
      minHits: 3,
      required: ["tudor|black", "tudor|bay", "black|bay"],
    });
  });

  it("asks for no name search when only filler words were typed", () => {
    expect(nameCandidateQuery("The watch", null)).toMatchObject({
      terms: [],
      minHits: 0,
    });
  });

  it("resolves exactly as the whole name index on random catalogues", () => {
    let compared = 0;
    let found = 0;
    let ambiguous = 0;
    for (let seed = 1; seed <= 120; seed += 1) {
      const next = random(seed);
      const rows = Array.from({ length: 120 }, (_, index) =>
        randomRow(next, index),
      ).sort(
        (a, b) =>
          a.brand.localeCompare(b.brand) ||
          a.model.localeCompare(b.model) ||
          a.id.localeCompare(b.id),
      );
      for (let typing = 0; typing < 12; typing += 1) {
        const { name, reference } = randomTyping(next, rows);
        const query = nameCandidateQuery(name, reference);
        const candidates = rows.filter((row) => isCandidate(row, query));
        const whole = resolveNamedWatch(rows, name, reference);
        expect(
          resolveNamedWatch(candidates, name, reference),
          `${name} / ${reference}`,
        ).toEqual(whole);
        compared += 1;
        if (whole.status === "found") found += 1;
        if (whole.status === "ambiguous") ambiguous += 1;
      }
    }
    // The comparison is not vacuous: many typings resolve or ask.
    expect(compared).toBe(1_440);
    expect(found).toBeGreaterThan(500);
    expect(ambiguous).toBeGreaterThan(400);
  }, 30_000);
});

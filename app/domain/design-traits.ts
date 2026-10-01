/**
 * How a watch looks, in a fixed vocabulary so two watches can be compared
 * trait by trait. Read once from each catalogue watch's product photo
 * (scripts/read-design-traits.ts) and stored in watch_catalogue.design_traits.
 * Unknown or unseen traits are null: never guessed.
 */
import { z } from "zod";

export const DIAL_COLOURS = [
  "black",
  "white",
  "silver",
  "cream",
  "grey",
  "blue",
  "green",
  "brown",
  "red",
  "orange",
  "yellow",
  "purple",
  "pink",
  "gold",
  "champagne",
  "salmon",
  "multicolour",
] as const;
export const DIAL_TEXTURES = [
  "plain",
  "sunburst",
  "textured",
  "guilloche",
  "skeleton",
] as const;
export const DIAL_LAYOUTS = [
  "time_only",
  "date",
  "chronograph_panda",
  "chronograph_reverse_panda",
  "chronograph",
  "gmt",
  "pilot",
  "complicated",
] as const;
export const NUMERALS = [
  "indices",
  "arabic",
  "roman",
  "mixed",
  "none",
] as const;
export const HAND_STYLES = [
  "baton",
  "dauphine",
  "sword",
  "mercedes",
  "snowflake",
  "broad_arrow",
  "leaf",
  "cathedral",
  "other",
] as const;
export const LUME = ["none", "white", "cream"] as const;
export const BEZELS = [
  "plain",
  "fluted",
  "dive",
  "gmt",
  "tachymeter",
  "slide_rule",
  "other",
] as const;
export const CASE_SHAPES = [
  "round",
  "cushion",
  "tonneau",
  "rectangular",
  "square",
  "octagonal",
] as const;
export const STRAPS = [
  "bracelet",
  "integrated_bracelet",
  "mesh",
  "leather",
  "rubber",
  "fabric",
] as const;
export const ERAS = ["vintage_inspired", "modern"] as const;

const oneOf = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) =>
      typeof value === "string"
        ? value
            .trim()
            .toLowerCase()
            .replaceAll(/[\s-]+/g, "_")
        : value,
    z.enum(values).nullable().catch(null),
  );

export const designTraitsSchema = z.object({
  dialColour: oneOf(DIAL_COLOURS),
  dialTexture: oneOf(DIAL_TEXTURES),
  dialLayout: oneOf(DIAL_LAYOUTS),
  numerals: oneOf(NUMERALS),
  handStyle: oneOf(HAND_STYLES),
  lume: oneOf(LUME),
  bezel: oneOf(BEZELS),
  /** The bezel or bezel insert's main colour(s), e.g. "black", "blue/red". */
  bezelColour: z.string().trim().max(40).nullable().catch(null),
  caseShape: oneOf(CASE_SHAPES),
  strap: oneOf(STRAPS),
  era: oneOf(ERAS),
  crownGuards: z.boolean().nullable().catch(null),
});

export type DesignTraits = z.infer<typeof designTraitsSchema>;

/** The instruction the photo reader gets: the vocabulary above, nothing else. */
export const DESIGN_TRAITS_PROMPT = [
  "Describe only what this product photo of a wristwatch shows. Use null for anything not clearly visible; never guess.",
  "Answer with JSON using exactly these keys and allowed values:",
  `dialColour: ${DIAL_COLOURS.join("|")}`,
  `dialTexture: ${DIAL_TEXTURES.join("|")}`,
  `dialLayout: ${DIAL_LAYOUTS.join("|")} (chronograph_panda = light dial with dark sub-dials; reverse_panda = the opposite; date = time with a date window)`,
  `numerals: ${NUMERALS.join("|")}`,
  `handStyle: ${HAND_STYLES.join("|")}`,
  `lume: ${LUME.join("|")} (cream = aged/vintage-tone lume)`,
  `bezel: ${BEZELS.join("|")}`,
  "bezelColour: the bezel or insert's colour(s), e.g. black, blue/red, or null for a plain steel bezel",
  `caseShape: ${CASE_SHAPES.join("|")}`,
  `strap: ${STRAPS.join("|")} (integrated_bracelet = bracelet flows straight out of the case with no visible lugs)`,
  `era: ${ERAS.join("|")}`,
  "crownGuards: true|false",
].join("\n");

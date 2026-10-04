/**
 * Partner sites: The Reserve's features on other websites (owner decision,
 * 2026-10-04). Pure rules, no network: key formats, which website addresses
 * may show a widget, and the theme a partner chose. The database side is in
 * partner-sites.server.ts; the pages are under /embed/:key/….
 *
 * Partners pay for the service, so every feature is included for every
 * site. The newsletter sign-up and the dossier email never appear inside a
 * partner widget, and no subscription is needed there.
 */
import { z } from "zod";

export const PARTNER_FEATURES = [
  "archetype",
  "quiz",
  "find",
  "alternatives",
  "stories",
] as const;
export type PartnerFeature = (typeof PARTNER_FEATURES)[number];

export const PARTNER_FEATURE_LABELS: Record<PartnerFeature, string> = {
  archetype: "Watch archetype quiz",
  quiz: "Watch diagnostic (shortlist)",
  find: "Watches from film, TV and people",
  alternatives: "Cheaper alternatives",
  stories: "Watches from movies (stories)",
};

export function isPartnerFeature(value: unknown): value is PartnerFeature {
  return (
    typeof value === "string" &&
    (PARTNER_FEATURES as readonly string[]).includes(value)
  );
}

export const PUBLIC_KEY_PATTERN = /^pk_live_[A-Za-z0-9]{24}$/;
export const SECRET_KEY_PATTERN = /^sk_live_[A-Za-z0-9]{40}$/;

const KEY_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function randomToken(
  length: number,
  random = crypto.getRandomValues.bind(crypto),
) {
  // 62 * 4 = 248: rejecting bytes ≥ 248 keeps every character equally likely.
  let out = "";
  while (out.length < length) {
    for (const byte of random(new Uint8Array(length * 2))) {
      if (byte < 248 && out.length < length) out += KEY_ALPHABET[byte % 62];
    }
  }
  return out;
}

export function newPublicKey() {
  return `pk_live_${randomToken(24)}`;
}

export function newSecretKey() {
  return `sk_live_${randomToken(40)}`;
}

/**
 * A website address as browsers send it in the Origin header
 * ("https://shop.example.com"), or null when it is not one. Paths, queries
 * and default ports are dropped; only http(s) is accepted, and plain http
 * only for localhost so partners can test on their own machine.
 */
export function normalizeOrigin(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) {
    return null;
  }
  if (!/^[a-z0-9.-]+$/.test(url.hostname) || !url.hostname.includes(".")) {
    if (!local) return null;
  }
  return url.origin;
}

/** Parses the admin's list (one per line or comma-separated). */
export function parseOriginList(text: string) {
  const origins: string[] = [];
  const invalid: string[] = [];
  for (const part of text.split(/[\s,]+/)) {
    if (!part) continue;
    const origin = normalizeOrigin(part);
    if (origin) {
      if (!origins.includes(origin)) origins.push(origin);
    } else invalid.push(part);
  }
  return { origins, invalid };
}

export function originAllowed(
  origin: string | null,
  allowedOrigins: readonly string[],
) {
  return origin !== null && allowedOrigins.includes(origin);
}

/**
 * The CSP frame-ancestors value: only the partner's own websites may show
 * the widget in a frame. An empty list means nobody can.
 */
export function frameAncestors(allowedOrigins: readonly string[]) {
  const sources = allowedOrigins
    .map(normalizeOrigin)
    .filter((origin): origin is string => origin !== null);
  return sources.length > 0 ? sources.join(" ") : "'none'";
}

// ---- Theme -----------------------------------------------------------------

const hexColour = z
  .string()
  .regex(/^#?[0-9a-fA-F]{6}$/)
  .transform((value) => `#${value.replace(/^#/, "").toLowerCase()}`);

export const PARTNER_FONTS = ["default", "system", "serif"] as const;

export const partnerThemeSchema = z.object({
  /** "dark" is The Reserve's own look; "light" suits most shop pages. */
  scheme: z.enum(["dark", "light"]).optional(),
  /** Buttons, links and highlights. */
  accent: hexColour.optional(),
  /** Page background. */
  background: hexColour.optional(),
  /** Cards and panels. */
  surface: hexColour.optional(),
  /** Main text. */
  text: hexColour.optional(),
  font: z.enum(PARTNER_FONTS).optional(),
  /** Corner rounding in pixels. */
  radius: z.coerce.number().int().min(0).max(32).optional(),
});
export type PartnerTheme = z.infer<typeof partnerThemeSchema>;

/** A stored or requested theme; anything invalid is simply left out. */
export function readTheme(input: unknown): PartnerTheme {
  if (!input || typeof input !== "object") return {};
  const theme: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    const field =
      partnerThemeSchema.shape[key as keyof typeof partnerThemeSchema.shape];
    if (!field || value === "" || value === null || value === undefined)
      continue;
    const parsed = field.safeParse(value);
    if (parsed.success && parsed.data !== undefined) theme[key] = parsed.data;
  }
  return theme;
}

const THEME_PARAMS = {
  scheme: "scheme",
  accent: "accent",
  background: "bg",
  surface: "surface",
  text: "text",
  font: "font",
  radius: "radius",
} as const satisfies Record<keyof PartnerTheme, string>;

/** Theme overrides a partner put on the widget tag, carried in the URL. */
export function themeFromSearch(params: URLSearchParams): PartnerTheme {
  const raw: Record<string, string> = {};
  for (const [key, param] of Object.entries(THEME_PARAMS)) {
    const value = params.get(param);
    if (value) raw[key] = value;
  }
  return readTheme(raw);
}

export function themeToSearch(theme: PartnerTheme) {
  const params = new URLSearchParams();
  for (const [key, param] of Object.entries(THEME_PARAMS)) {
    const value = theme[key as keyof PartnerTheme];
    if (value !== undefined) params.set(param, String(value).replace(/^#/, ""));
  }
  return params;
}

export const THEME_PARAM_NAMES: readonly string[] = Object.values(THEME_PARAMS);

function mix(hex: string, toward: string, amount: number) {
  const channel = (value: string, at: number) =>
    parseInt(value.slice(at, at + 2), 16);
  const out = [1, 3, 5].map((at) =>
    Math.round(channel(hex, at) * (1 - amount) + channel(toward, at) * amount)
      .toString(16)
      .padStart(2, "0"),
  );
  return `#${out.join("")}`;
}

const LIGHT_SCHEME: Record<string, string> = {
  "--color-base": "#ffffff",
  "--color-base-raised": "#f7f6f3",
  "--color-surface": "#f4f2ee",
  "--color-surface-hover": "#ebe8e2",
  "--color-ink": "#16181c",
  "--color-ink-soft": "#3b4048",
  "--color-steel": "#6b7680",
  "--color-steel-dim": "#c3c8cd",
  "--color-steel-text": "#59636c",
  "--color-line": "#e3e0da",
  "--color-line-strong": "#cfcac1",
  "--color-success": "#2f7a3b",
  "--color-danger": "#a8322a",
  "--shadow-card": "0 10px 30px -22px rgb(0 0 0 / 35%)",
};

const FONT_STACKS: Record<(typeof PARTNER_FONTS)[number], string | null> = {
  default: null,
  system:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  serif: 'Georgia, "Iowan Old Style", "Times New Roman", serif',
};

/**
 * CSS custom properties for a theme (the site's stored theme, then the
 * widget tag's overrides). Every value has passed partnerThemeSchema, so
 * nothing a partner types can break out of the declaration.
 */
export function themeVariables(theme: PartnerTheme): Record<string, string> {
  const vars: Record<string, string> = {};
  if (theme.scheme === "light") Object.assign(vars, LIGHT_SCHEME);
  if (theme.background) {
    vars["--color-base"] = theme.background;
    vars["--color-base-raised"] = theme.background;
  }
  if (theme.surface) {
    vars["--color-surface"] = theme.surface;
    vars["--color-surface-hover"] = theme.surface;
  }
  if (theme.text) {
    vars["--color-ink"] = theme.text;
    vars["--color-ink-soft"] = theme.text;
  }
  if (theme.accent) {
    vars["--color-brass"] = theme.accent;
    vars["--color-brass-bright"] = mix(
      theme.accent,
      theme.scheme === "light" ? "#000000" : "#ffffff",
      0.18,
    );
    vars["--color-brass-wash"] = `${theme.accent}24`;
  }
  const stack = theme.font ? FONT_STACKS[theme.font] : null;
  if (stack) {
    vars["--font-sans"] = stack;
    vars["--font-display"] = stack;
  }
  if (theme.radius !== undefined) {
    vars["--radius-sm"] = `${Math.round(theme.radius * 0.6)}px`;
    vars["--radius"] = `${theme.radius}px`;
    vars["--radius-lg"] = `${Math.round(theme.radius * 1.4)}px`;
  }
  return vars;
}

export function themeCss(theme: PartnerTheme) {
  const vars = themeVariables(theme);
  const body = Object.entries(vars)
    .map(([name, value]) => `${name}:${value}`)
    .join(";");
  return body ? `:root{${body}}` : "";
}

// ---- Widget ↔ host page messages ----------------------------------------------

/** Messages the widget sends to the page it sits on (see public/embed.js). */
export type WidgetMessage =
  | { type: "reserve:ready"; feature: PartnerFeature; height: number }
  | { type: "reserve:resize"; height: number }
  | { type: "reserve:navigate"; feature: PartnerFeature; path: string }
  | { type: "reserve:results"; feature: PartnerFeature; count: number };

/** Where each site page lives inside a widget. */
const EMBED_PATHS: [
  RegExp,
  PartnerFeature,
  (match: RegExpMatchArray) => string,
][] = [
  [/^\/quiz$/, "quiz", () => "quiz"],
  [/^\/watches\/find$/, "find", () => "find"],
  [/^\/watches\/alternatives$/, "alternatives", () => "alternatives"],
  [/^\/watches\/archetype$/, "archetype", () => "archetype"],
  [/^\/watches$/, "stories", () => "stories"],
  [
    /^\/watches\/stories\/([a-z0-9-]+)$/,
    "stories",
    (match) => `stories/${match[1]}`,
  ],
];

/**
 * A link inside a widget: site pages that exist as widgets stay inside the
 * frame (keeping the key and theme); everything else opens The Reserve in a
 * new tab.
 */
export function embedHref(
  to: string,
  embed: { key: string; themeQuery: string; siteOrigin: string },
): { internal: boolean; href: string } {
  const url = new URL(to, "https://placeholder.invalid");
  for (const [pattern, , build] of EMBED_PATHS) {
    const match = url.pathname.match(pattern);
    if (!match) continue;
    const params = new URLSearchParams(url.search);
    for (const [name, value] of new URLSearchParams(embed.themeQuery)) {
      if (!params.has(name)) params.set(name, value);
    }
    const query = params.toString();
    return {
      internal: true,
      href: `/embed/${embed.key}/${build(match)}${query ? `?${query}` : ""}${url.hash}`,
    };
  }
  return {
    internal: false,
    href: new URL(`${url.pathname}${url.search}${url.hash}`, embed.siteOrigin)
      .href,
  };
}

/**
 * The Reserve's own page for a widget address, without the key and theme:
 * where a visitor who opens a widget outside a frame is sent.
 */
export function sitePathForEmbed(url: URL) {
  const [, , , feature, slug] = url.pathname.split("/");
  const path =
    feature === "quiz"
      ? "/quiz"
      : feature === "find"
        ? "/watches/find"
        : feature === "alternatives"
          ? "/watches/alternatives"
          : feature === "archetype"
            ? "/watches/archetype"
            : feature === "stories" && slug && /^[a-z0-9-]+$/.test(slug)
              ? `/watches/stories/${slug}`
              : "/watches";
  const params = new URLSearchParams(url.search);
  for (const name of THEME_PARAM_NAMES) params.delete(name);
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}

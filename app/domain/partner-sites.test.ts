import {
  embedHref,
  frameAncestors,
  newPublicKey,
  newSecretKey,
  normalizeOrigin,
  originAllowed,
  parseOriginList,
  PUBLIC_KEY_PATTERN,
  readTheme,
  SECRET_KEY_PATTERN,
  sitePathForEmbed,
  themeCss,
  themeFromSearch,
  themeToSearch,
} from "./partner-sites";

describe("partner keys", () => {
  it("generates keys in the formats the database accepts", () => {
    for (let index = 0; index < 50; index += 1) {
      expect(newPublicKey()).toMatch(PUBLIC_KEY_PATTERN);
      expect(newSecretKey()).toMatch(SECRET_KEY_PATTERN);
    }
    expect(newPublicKey()).not.toBe(newPublicKey());
  });
});

describe("partner website addresses", () => {
  it("keeps only the origin of an https address", () => {
    expect(normalizeOrigin("https://Shop.Example.com/watches?x=1")).toBe(
      "https://shop.example.com",
    );
    expect(normalizeOrigin("shop.example.com")).toBe(
      "https://shop.example.com",
    );
    expect(normalizeOrigin("https://shop.example.com:8443")).toBe(
      "https://shop.example.com:8443",
    );
  });

  it("refuses plain http except on the partner's own machine", () => {
    expect(normalizeOrigin("http://shop.example.com")).toBeNull();
    expect(normalizeOrigin("http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
    expect(normalizeOrigin("javascript:alert(1)")).toBeNull();
    expect(normalizeOrigin("https://user:pass@shop.example.com")).toBeNull();
    expect(normalizeOrigin("https://intranet")).toBeNull();
    expect(normalizeOrigin("")).toBeNull();
  });

  it("parses the admin's list and reports what it could not read", () => {
    expect(
      parseOriginList(
        "https://a.example.com\nb.example.com, https://a.example.com/x  nope",
      ),
    ).toEqual({
      origins: ["https://a.example.com", "https://b.example.com"],
      invalid: ["nope"],
    });
  });

  it("allows framing only by the registered websites", () => {
    expect(
      frameAncestors(["https://a.example.com", "https://b.example.com"]),
    ).toBe("https://a.example.com https://b.example.com");
    expect(frameAncestors([])).toBe("'none'");
    // A stored value that is not an origin can never widen the policy.
    expect(frameAncestors(["* 'unsafe-inline'"])).toBe("'none'");
    expect(
      originAllowed("https://a.example.com", ["https://a.example.com"]),
    ).toBe(true);
    expect(originAllowed(null, ["https://a.example.com"])).toBe(false);
    expect(
      originAllowed("https://evil.example", ["https://a.example.com"]),
    ).toBe(false);
  });
});

describe("partner theme", () => {
  it("keeps valid values and drops everything else", () => {
    expect(
      readTheme({
        scheme: "light",
        accent: "0A7CFF",
        background: "#fff",
        text: "red;}</style><script>",
        font: "comic",
        radius: "12",
        other: "x",
      }),
    ).toEqual({ scheme: "light", accent: "#0a7cff", radius: 12 });
    expect(readTheme(null)).toEqual({});
    expect(readTheme({ radius: 99 })).toEqual({});
  });

  it("round-trips through the widget's URL", () => {
    const theme = readTheme({ scheme: "light", accent: "#0a7cff", radius: 8 });
    const params = themeToSearch(theme);
    expect(params.toString()).toBe("scheme=light&accent=0a7cff&radius=8");
    expect(themeFromSearch(params)).toEqual(theme);
  });

  it("writes CSS custom properties only from validated values", () => {
    const css = themeCss(
      readTheme({ scheme: "light", accent: "#0a7cff", font: "system" }),
    );
    expect(css.startsWith(":root{")).toBe(true);
    expect(css).toContain("--color-base:#ffffff");
    expect(css).toContain("--color-brass:#0a7cff");
    expect(css).toContain("--font-sans:-apple-system");
    expect(css).not.toContain("<");
    expect(themeCss({})).toBe("");
  });
});

describe("links inside a widget", () => {
  const embed = {
    key: "pk_live_abcdefghijklmnopqrstuvwx",
    themeQuery: "scheme=light",
    siteOrigin: "https://thereserve.watch",
  };

  it("keeps widget pages in the frame with the key and theme", () => {
    expect(embedHref("/watches/find?type=actor&q=Heat", embed)).toEqual({
      internal: true,
      href: "/embed/pk_live_abcdefghijklmnopqrstuvwx/find?type=actor&q=Heat&scheme=light",
    });
    expect(embedHref("/quiz?source=archetype", embed).href).toBe(
      "/embed/pk_live_abcdefghijklmnopqrstuvwx/quiz?source=archetype&scheme=light",
    );
    expect(embedHref("/watches/stories/bond-omega", embed).href).toBe(
      "/embed/pk_live_abcdefghijklmnopqrstuvwx/stories/bond-omega?scheme=light",
    );
    expect(embedHref("/watches", embed).href).toBe(
      "/embed/pk_live_abcdefghijklmnopqrstuvwx/stories?scheme=light",
    );
  });

  it("sends every other page to The Reserve itself", () => {
    expect(embedHref("/", embed)).toEqual({
      internal: false,
      href: "https://thereserve.watch/",
    });
    expect(embedHref("/watches/people/daniel-craig", embed)).toEqual({
      internal: false,
      href: "https://thereserve.watch/watches/people/daniel-craig",
    });
  });
});

describe("a widget opened outside a frame", () => {
  const at = (path: string) =>
    sitePathForEmbed(new URL(path, "https://x.test"));

  it("goes to The Reserve's own page, without the key or theme", () => {
    expect(at("/embed/pk_live_abc/quiz?scheme=light&source=archetype")).toBe(
      "/quiz?source=archetype",
    );
    expect(at("/embed/pk_live_abc/find?type=actor&q=Heat&accent=00ff00")).toBe(
      "/watches/find?type=actor&q=Heat",
    );
    expect(at("/embed/pk_live_abc/stories/bond-omega")).toBe(
      "/watches/stories/bond-omega",
    );
    expect(at("/embed/pk_live_abc/stories")).toBe("/watches");
    expect(at("/embed/pk_live_abc/alternatives")).toBe("/watches/alternatives");
  });
});

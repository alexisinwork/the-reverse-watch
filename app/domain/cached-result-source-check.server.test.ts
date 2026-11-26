import { describe, expect, it, vi } from "vitest";
import type { FoundWatch } from "./ai-watch-types";
import {
  headingPassage,
  inspectCachedResultSource,
  pageBlocks,
  pageSentences,
  sightingPassage,
} from "./cached-result-source-check.server";
import { passageTiesSighting } from "./attribution-names";

const watch: FoundWatch = {
  brand: "Omega",
  model: "Aqua Terra",
  referenceCode: "231.10.39.21.03.001",
  sourceUrl: "https://example.com",
  imageUrl: null,
  priceNote: null,
  rationale: "",
  details: { person: "Daniel Craig", work: "Skyfall" },
};
function response(body: string, status = 200, contentType = "text/html") {
  return vi.fn(
    async () =>
      new Response(body, { status, headers: { "content-type": contentType } }),
  ) as unknown as typeof fetch;
}

describe("checking source pages for cached watch claims", () => {
  it("does not use counterfeit watch sellers as reference evidence", async () => {
    const fetchImpl = vi.fn();
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://www.fakeluxurywatches.com/watch",
          fetchImpl,
        )
      ).status,
    ).toBe("unavailable");
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it("finds the exact reference, brand, wearer and film in page text", async () => {
    const html =
      "<p>Daniel Craig wore Omega 231.10.39.21.03.001 in Skyfall.</p>";
    expect(
      await inspectCachedResultSource(
        watch,
        "https://source.example/a",
        response(html),
        "Daniel Craig wore Omega 231.10.39.21.03.001 in Skyfall.",
      ),
    ).toEqual({
      status: "matched",
      finalUrl: "https://source.example/a",
      passage: "Daniel Craig wore Omega 231.10.39.21.03.001 in Skyfall.",
    });
  });

  it("rejects a fabricated passage when the person and reference occur separately", async () => {
    const page =
      "Daniel Craig appears in Skyfall. Naomie Harris wears Omega 231.10.39.21.03.001.";
    const invented = "Daniel Craig wore Omega 231.10.39.21.03.001 in Skyfall.";
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example/a",
          response(page),
          invented,
        )
      ).status,
    ).toBe("missing");
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example/a",
          response(page),
        )
      ).status,
    ).toBe("missing");
  });

  it("does not treat a reference appearing only in a URL or script as page evidence", async () => {
    const html =
      "<script>Omega 231.10.39.21.03.001 Daniel Craig Skyfall</script><p>Unrelated.</p>";
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example/231.10.39.21.03.001",
          response(html),
        )
      ).status,
    ).toBe("missing");
  });

  it("does not treat another wearer, a different reference, or an HTTP failure as confirmation", async () => {
    const wrongWearer = "Omega 231.10.39.21.03.001 Naomie Harris Skyfall";
    const wrongRef = "Omega 231.10.39.21.03.001X Daniel Craig Skyfall";
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          response(wrongWearer),
        )
      ).status,
    ).toBe("missing");
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          response(wrongRef),
        )
      ).status,
    ).toBe("missing");
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          response("", 403),
        )
      ).status,
    ).toBe("unavailable");
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          response("", 200, "image/jpeg"),
        )
      ).status,
    ).toBe("unavailable");
  });

  it("refuses private-address redirects", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(null, {
          status: 302,
          headers: { location: "http://127.0.0.1/admin" },
        }),
    ) as unknown as typeof fetch;
    expect(
      (
        await inspectCachedResultSource(
          watch,
          "https://source.example",
          fetchImpl,
        )
      ).status,
    ).toBe("unavailable");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("checking sightings written the way providers write them", () => {
  const casinoRoyale: FoundWatch = {
    brand: "Omega",
    model: "Seamaster Planet Ocean 600M",
    referenceCode: "2900.50.91",
    sourceUrl: "https://example.com",
    imageUrl: null,
    priceNote: null,
    rationale: "",
    details: { person: "James Bond (Daniel Craig)", work: "Casino Royale" },
  };
  const page =
    "<h1>Omega Seamaster Planet Ocean 600M 2900.50.91</h1>" +
    "<p>Daniel Craig wore the Omega Seamaster Planet Ocean in Casino Royale.</p>";

  it("matches one name of a compound wearer and the model words in the passage", async () => {
    expect(
      (
        await inspectCachedResultSource(
          casinoRoyale,
          "https://source.example/b",
          response(page),
          "Daniel Craig wore the Omega Seamaster Planet Ocean in Casino Royale.",
        )
      ).status,
    ).toBe("matched");
  });

  it("still needs the exact reference somewhere on the page", async () => {
    expect(
      (
        await inspectCachedResultSource(
          casinoRoyale,
          "https://source.example/b",
          response(
            "<p>Daniel Craig wore the Omega Seamaster Planet Ocean in Casino Royale.</p>",
          ),
          "Daniel Craig wore the Omega Seamaster Planet Ocean in Casino Royale.",
        )
      ).status,
    ).toBe("missing");
  });
});

describe("reading the page's own sentences for a sighting", () => {
  const ripley: FoundWatch = {
    brand: "Seiko",
    model: "7A28-7000",
    referenceCode: "7A28-7000",
    sourceUrl: "https://example.com",
    imageUrl: null,
    priceNote: null,
    rationale: "",
    details: { person: null, work: "Aliens" },
  };
  const hodinkee =
    "<h1>Sigourney Weaver Wears A Seiko Ripley In Aliens</h1>" +
    "<p>Its asymmetric case became known as the &quot;Ripley&quot; after Sigourney Weaver wore it as Ellen Ripley in <em>Aliens</em> (1986).</p>" +
    "<p>We are, of course, talking about Seiko&#8217;s 7A28-7000, as seen on the wrist of Ellen Ripley (Sigourney Weaver) in James Cameron&#8217;s 1986 film, Aliens.</p>";

  it("finds the sentence that ties the watch when the provider quoted another one", async () => {
    const result = await inspectCachedResultSource(
      ripley,
      "https://source.example/aliens",
      response(hodinkee),
      "Its asymmetric case became known as the Ripley after Sigourney Weaver wore it as Ellen Ripley in Aliens (1986).",
    );
    expect(result.status).toBe("matched");
    expect(result.passage).toBe(
      "We are, of course, talking about Seiko’s 7A28-7000, as seen on the wrist of Ellen Ripley (Sigourney Weaver) in James Cameron’s 1986 film, Aliens.",
    );
  });

  it("never joins two sentences into a tie", async () => {
    const apart =
      "<p>Sigourney Weaver stars in Aliens.</p><p>The Seiko 7A28-7000 is a quartz chronograph.</p>";
    expect(
      (
        await inspectCachedResultSource(
          ripley,
          "https://source.example/apart",
          response(apart),
        )
      ).status,
    ).toBe("missing");
  });

  it("takes a short run of words from a long sentence", () => {
    const long =
      "<p>Among the many pieces of hardware that the production designers gathered for the colonial marines, and long before anyone called it by a nickname, the Seiko 7A28-7000 appeared in Aliens on the wrist of its heroine, which collectors still talk about at every meeting today.</p>";
    const passage = sightingPassage(long, ripley);
    expect(passage).toBe("Seiko 7A28-7000 appeared in Aliens");
  });

  it("keeps an abbreviation inside its sentence", () => {
    expect(
      pageSentences(
        "<p>Sean Connery wore a Rolex Submariner 6538 in Dr. No. It was his own watch.</p>",
      ),
    ).toEqual([
      "Sean Connery wore a Rolex Submariner 6538 in Dr. No.",
      "It was his own watch.",
    ]);
    expect(
      sightingPassage(
        "<p>Sean Connery wore a Rolex Submariner 6538 in Dr. No. It was his own watch.</p>",
        {
          brand: "Rolex",
          model: "6538",
          referenceCode: "6538",
          details: { person: null, work: "Dr. No" },
        },
      ),
    ).toBe("Sean Connery wore a Rolex Submariner 6538 in Dr. No.");
  });
});

describe("a page about the subject", () => {
  const mcclane: FoundWatch = {
    brand: "TAG Heuer",
    model: "232.206",
    referenceCode: "232.206",
    sourceUrl: "https://example.com",
    imageUrl: null,
    priceNote: null,
    rationale: "",
    details: { person: null, work: "Die Hard" },
  };
  const bamf =
    "<html><head><title>Bruce Willis in Die Hard &raquo; BAMF Style</title></head><body>" +
    "<h2>The Watch</h2><p>He also wears a chunky stainless steel TAG Heuer 3000 Professional chronograph, specifically the ref. 232.206 with a rotating steel bezel and three dark sub-dials that the production auctioned years later.</p></body></html>";

  it("ties a sentence with the exact reference to the film its title names", async () => {
    const result = await inspectCachedResultSource(
      mcclane,
      "https://source.example/die-hard",
      response(bamf),
    );
    expect(result.status).toBe("matched");
    expect(result.passage).toBe(
      "Bruce Willis in Die Hard » BAMF Style … TAG Heuer 3000 Professional chronograph, specifically the ref. 232.206",
    );
    // The stored passage satisfies the same rule when a snapshot is read.
    expect(passageTiesSighting(result.passage!, mcclane)).toBe(true);
  });

  it("needs the title to name this film and the sentence the exact reference", () => {
    expect(
      headingPassage(bamf.replace("Die Hard", "Die Hard 2"), {
        ...mcclane,
        details: { person: null, work: "Die Hard" },
      }),
    ).not.toBeNull(); // "Die Hard 2" still names "Die Hard" as whole words
    expect(
      headingPassage(
        bamf.replace("Bruce Willis in Die Hard", "Every watch in Nolan films"),
        mcclane,
      ),
    ).toBeNull();
    expect(
      headingPassage(bamf.replace("ref. 232.206", "a quartz model"), mcclane),
    ).toBeNull();
  });

  it("treats Bvlgari and Bulgari as one brand", async () => {
    const heat =
      "<p>In Heat, Val Kilmer wears the Bulgari Diagono Scuba SD38SG through most of the film.</p>";
    const result = await inspectCachedResultSource(
      {
        ...mcclane,
        brand: "Bvlgari",
        model: "SD38SG",
        referenceCode: "SD38SG",
        details: { person: null, work: "Heat" },
      },
      "https://source.example/heat",
      response(heat),
    );
    expect(result.status).toBe("matched");
  });
});

describe("an actor's page with the film in the sentence", () => {
  const vronsky: FoundWatch = {
    brand: "Rolex",
    model: "1665",
    referenceCode: "1665",
    sourceUrl: "https://example.com",
    imageUrl: null,
    priceNote: null,
    rationale: "",
    details: {
      person: 'Michael "Mike" Vronsky (Robert De Niro)',
      work: "The Deer Hunter (1978)",
    },
  };
  const page =
    "<title>11 Iconic Wristwatches Worn by Robert De Niro in Movies</title>" +
    "<h2>Rolex Sea-Dweller 1665: The Deer Hunter, 1978</h2>" +
    "<p>A rare piece for a working-class steelworker.</p>";

  it("ties the heading's actor to the sentence's watch and film", () => {
    const passage = headingPassage(page, vronsky);
    expect(passage).toBe(
      "11 Iconic Wristwatches Worn by Robert De Niro in Movies … Rolex Sea-Dweller 1665: The Deer Hunter, 1978",
    );
    expect(passageTiesSighting(passage!, vronsky)).toBe(true);
  });

  it("needs the film named in the heading or the sentence", () => {
    expect(
      headingPassage(page.replace(": The Deer Hunter, 1978", ""), vronsky),
    ).toBeNull();
  });
});

describe("sentences read with the sections they sit under", () => {
  const ledger: FoundWatch = {
    brand: "Casio",
    model: "CA-53W-1",
    referenceCode: "CA-53W-1",
    sourceUrl: "https://example.com",
    imageUrl: null,
    priceNote: null,
    rationale: "",
    details: { person: "Joker (Heath Ledger)", work: "The Dark Knight (2008)" },
  };
  const database =
    "<title>The Dark Knight (2008) - Internet Movie Watch Database</title>" +
    "<h2>Christian Bale as Bruce Wayne</h2><p>Jaeger-LeCoultre Reverso 270.8.62</p>" +
    "<h2>Heath Ledger as The Joker</h2><p>Casio CA-53W-1</p>";

  it("ties a database entry to the actor's section and the film's title", () => {
    expect(pageBlocks(database).at(-1)).toEqual({
      text: "Casio CA-53W-1",
      headings: [
        "The Dark Knight (2008) - Internet Movie Watch Database",
        "Heath Ledger as The Joker",
      ],
    });
    const passage = headingPassage(database, ledger);
    expect(passage).toBe(
      "The Dark Knight (2008) - Internet Movie Watch Database … Heath Ledger as The Joker … Casio CA-53W-1",
    );
    expect(passageTiesSighting(passage!, ledger)).toBe(true);
  });

  it("never lends another section's wearer", () => {
    expect(
      headingPassage(database, {
        ...ledger,
        brand: "Jaeger-LeCoultre",
        model: "270.8.62",
        referenceCode: "270.8.62",
      }),
    ).toBeNull();
  });

  it("takes the brand from a heading when the sentence gives the exact reference", () => {
    const spotted =
      "<title>Casio CA-53W - Joker in The Dark Knight | WatchReel</title>" +
      "<h1>Casio CA-53W - Joker in The Dark Knight</h1>" +
      "<p>The CA-53W-1 is listed at $29.95, with no vintage premium.</p>";
    expect(headingPassage(spotted, ledger)).toBe(
      "Casio CA-53W - Joker in The Dark Knight … The CA-53W-1 is listed at $29.95, with no vintage premium.",
    );
  });
});

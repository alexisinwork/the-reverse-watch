import { describe, expect, it } from "vitest";

import { episodeDestination, profileDestination } from "./episode-links";
import {
  campaignLabel,
  firstTouchFrom,
  firstTouchFromForm,
  loadTabSession,
  plainTag,
  sourceForHost,
  TAB_SESSION_KEY,
  type FirstTouch,
} from "./first-touch";

const ownHost = "thereserve.watch";
const touchAt = (address: string, referrer = "") => {
  const url = new URL(address, "https://thereserve.watch");
  return firstTouchFrom({
    search: url.search,
    referrer,
    landing: url.pathname,
    ownHost,
  });
};

describe("how a visit began", () => {
  it("names the platform behind a referring site", () => {
    expect(sourceForHost("instagram.com")).toBe("instagram");
    expect(sourceForHost("l.instagram.com")).toBe("instagram");
    expect(sourceForHost("www.tiktok.com")).toBe("tiktok");
    expect(sourceForHost("tiktok.com")).toBe("tiktok");
    expect(sourceForHost("www.youtube.com")).toBe("youtube");
    expect(sourceForHost("m.youtube.com")).toBe("youtube");
    expect(sourceForHost("youtu.be")).toBe("youtube");
    expect(sourceForHost("www.google.com")).toBe("www.google.com");
    // Look-alike hosts are not the platform.
    expect(sourceForHost("notinstagram.com")).toBe("notinstagram.com");
  });

  it("prefers the link's utm tags over the referring site", () => {
    expect(
      touchAt(
        "/start?utm_source=instagram&utm_medium=social&utm_campaign=bio",
        "https://www.google.com/",
      ),
    ).toEqual({
      source: "instagram",
      medium: "social",
      campaign: "bio",
      landing: "/start",
    });
  });

  it("falls back to the referrer, and to direct without one", () => {
    expect(touchAt("/", "https://l.instagram.com/?u=x")).toEqual({
      source: "instagram",
      medium: "referral",
      landing: "/",
    });
    expect(touchAt("/watches/find", "https://m.youtube.com/watch?v=1")).toEqual(
      { source: "youtube", medium: "referral", landing: "/watches/find" },
    );
    expect(touchAt("/", "https://youtu.be/abc").source).toBe("youtube");
    expect(touchAt("/", "https://www.tiktok.com/@x").source).toBe("tiktok");
    expect(touchAt("/", "https://news.example.org/a/b").source).toBe(
      "news.example.org",
    );
    // An address typed by hand, e.g. after the ad in an episode.
    expect(touchAt("/")).toEqual({
      source: "direct",
      medium: "none",
      landing: "/",
    });
    expect(touchAt("/", "not a url").source).toBe("direct");
    expect(touchAt("/quiz", "https://thereserve.watch/start").source).toBe(
      "internal",
    );
  });

  it("keeps only plain tag values", () => {
    expect(plainTag(" YouTube ")).toBe("youtube");
    expect(plainTag("ep 11")).toBe("ep_11");
    expect(plainTag("<script>")).toBe("script");
    expect(plainTag("@@@")).toBeUndefined();
    expect(plainTag(null)).toBeUndefined();
    expect(touchAt("/?utm_source=x@y.com&utm_medium=%3Cb%3E").source).toBe(
      "x_y.com",
    );
  });

  it("keeps a Short apart from the long video of the same episode", () => {
    const shorts: FirstTouch = {
      source: "youtube",
      medium: "shorts",
      campaign: "ep11",
      landing: "/",
    };
    expect(campaignLabel(shorts)).toBe("ep11 shorts");
    expect(campaignLabel({ ...shorts, medium: "video" })).toBe("ep11");
    expect(campaignLabel({ ...shorts, campaign: undefined })).toBeUndefined();
  });
});

describe("the platforms' short links", () => {
  // Each short link's redirect target is the visit's landing address.
  const landing = (target: string | null) => touchAt(target ?? "");
  it("count /ig, /tt and /yt under their platform's bio campaign", () => {
    expect(landing(profileDestination("ig"))).toMatchObject({
      source: "instagram",
      medium: "social",
      campaign: "bio",
    });
    expect(landing(profileDestination("tt"))).toMatchObject({
      source: "tiktok",
      medium: "social",
      campaign: "bio",
    });
    expect(landing(profileDestination("yt"))).toMatchObject({
      source: "youtube",
      medium: "social",
      campaign: "bio",
    });
  });
  it("count /e/1 under youtube · video · ep1 and /ys/1 as a Short", () => {
    expect(landing(episodeDestination("1"))).toMatchObject({
      source: "youtube",
      medium: "video",
      campaign: "ep1",
    });
    const short = landing(episodeDestination("1", "ys"));
    expect(short).toMatchObject({ source: "youtube", medium: "shorts" });
    expect(campaignLabel(short)).toBe("ep1 shorts");
    expect(landing(episodeDestination("4", "tt"))).toMatchObject({
      source: "tiktok",
      medium: "short_video",
      campaign: "ep4",
    });
  });
});

describe("the tab session", () => {
  const memory = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      values,
    };
  };
  const instagram = () =>
    touchAt("/start?utm_source=instagram&utm_medium=social&utm_campaign=bio");

  it("keeps the first page's touch for the rest of the tab", () => {
    const storage = memory();
    let ids = 0;
    const newId = () => `00000000-0000-4000-8000-00000000000${++ids}`;
    const first = loadTabSession(storage, instagram, newId);
    // A reload, or the plain link from /start to the archetype quiz.
    const later = loadTabSession(
      storage,
      () => touchAt("/watches/archetype"),
      newId,
    );
    expect(later).toEqual(first);
    expect(later.firstTouch.source).toBe("instagram");
    expect(later.firstTouch.landing).toBe("/start");
    expect(JSON.parse(storage.values.get(TAB_SESSION_KEY)!)).toEqual(first);
  });

  it("works in memory when storage is blocked or damaged", () => {
    const blocked = {
      getItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
      setItem: () => {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    expect(loadTabSession(blocked, instagram).firstTouch.source).toBe(
      "instagram",
    );
    expect(loadTabSession(null, instagram).firstTouch.source).toBe("instagram");
    const damaged = memory();
    damaged.setItem(TAB_SESSION_KEY, '{"sessionId":"x","firstTouch":{}}');
    expect(loadTabSession(damaged, instagram).firstTouch.source).toBe(
      "instagram",
    );
  });
});

describe("the sign-up form's first-touch fields", () => {
  const form = (entries: Record<string, string>) => {
    const data = new FormData();
    for (const [key, value] of Object.entries(entries)) data.set(key, value);
    return data;
  };
  it("reads a valid touch and drops an empty campaign", () => {
    expect(
      firstTouchFromForm(
        form({
          touchSource: "youtube",
          touchMedium: "video",
          touchCampaign: "ep2",
          touchLanding: "/watches/find",
        }),
      ),
    ).toEqual({
      source: "youtube",
      medium: "video",
      campaign: "ep2",
      landing: "/watches/find",
    });
    expect(
      firstTouchFromForm(
        form({ touchSource: "direct", touchMedium: "none", touchLanding: "/" }),
      ),
    ).toEqual({ source: "direct", medium: "none", landing: "/" });
  });
  it("refuses anything that is not a plain tag or a path", () => {
    expect(firstTouchFromForm(form({}))).toBeNull();
    expect(
      firstTouchFromForm(
        form({
          touchSource: "a@b.com",
          touchMedium: "none",
          touchLanding: "/",
        }),
      ),
    ).toBeNull();
    expect(
      firstTouchFromForm(
        form({
          touchSource: "direct",
          touchMedium: "none",
          touchLanding: "https://evil.example/",
        }),
      ),
    ).toBeNull();
  });
});

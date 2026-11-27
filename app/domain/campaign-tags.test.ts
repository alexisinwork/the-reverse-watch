import { analyticsAddress, withCampaignTags } from "./campaign-tags";

describe("address sent to Vercel Web Analytics", () => {
  it("keeps the page and its plain campaign tags only", () => {
    expect(
      analyticsAddress(
        "https://thereserve.watch/watches/find?q=Alice%20Example&utm_source=youtube&utm_medium=shorts&utm_campaign=ep11&email=a%40b.example#top",
      ),
    ).toBe(
      "https://thereserve.watch/watches/find?utm_source=youtube&utm_medium=shorts&utm_campaign=ep11",
    );
  });

  it("drops tags that are not plain and every other parameter", () => {
    expect(
      analyticsAddress(
        "https://thereserve.watch/quiz?utm_campaign=%3Cscript%3E&utm_term=private&token=secret",
      ),
    ).toBe("https://thereserve.watch/quiz");
  });
});

describe("campaign tags through a gate", () => {
  it("keeps an episode's three tags, the target's own query and its hash", () => {
    expect(
      withCampaignTags(
        "/?diagnostic=subscription#newsletter-signup",
        "https://thereserve.watch/quiz?utm_source=youtube&utm_medium=video&utm_campaign=ep35",
      ),
    ).toBe(
      "/?diagnostic=subscription&utm_source=youtube&utm_medium=video&utm_campaign=ep35#newsletter-signup",
    );
  });

  it("copies nothing else from the address", () => {
    expect(
      withCampaignTags(
        "/?diagnostic=subscription",
        "https://thereserve.watch/quiz?email=a%40b.example&token=secret&utm_campaign=ep3",
      ),
    ).toBe("/?diagnostic=subscription&utm_campaign=ep3");
  });

  it("drops tag values that are not plain", () => {
    expect(
      withCampaignTags(
        "/",
        "https://thereserve.watch/quiz?utm_campaign=%3Cscript%3E&utm_source=you%20tube",
      ),
    ).toBe("/");
  });

  it("changes nothing without tags", () => {
    expect(
      withCampaignTags(
        "/?diagnostic=subscription&story=don-draper-mad-men-omega#newsletter-signup",
        "https://thereserve.watch/quiz?story=don-draper-mad-men-omega",
      ),
    ).toBe(
      "/?diagnostic=subscription&story=don-draper-mad-men-omega#newsletter-signup",
    );
  });
});

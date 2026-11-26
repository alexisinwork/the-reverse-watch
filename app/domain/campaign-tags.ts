/**
 * The campaign tags an episode short link adds (episode-links.ts) must
 * survive a gate that sends the visitor elsewhere, such as the newsletter
 * sign-up in front of the diagnostic and the alternatives finder; otherwise
 * the visit no longer counts for its episode. Only these three tags pass,
 * and only plain values: nothing else from the address is copied.
 */
const CAMPAIGN_TAGS = ["utm_source", "utm_medium", "utm_campaign"] as const;
const PLAIN_VALUE = /^[A-Za-z0-9_.-]{1,60}$/;

export function withCampaignTags(target: string, from: string | URL) {
  const source = typeof from === "string" ? new URL(from) : from;
  const hashAt = target.indexOf("#");
  const path = hashAt >= 0 ? target.slice(0, hashAt) : target;
  const hash = hashAt >= 0 ? target.slice(hashAt) : "";
  const url = new URL(path, "https://thereserve.watch");
  for (const tag of CAMPAIGN_TAGS) {
    const value = source.searchParams.get(tag);
    if (value && PLAIN_VALUE.test(value)) url.searchParams.set(tag, value);
  }
  return `${url.pathname}${url.search}${hash}`;
}

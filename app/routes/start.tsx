/**
 * /start — the page the Instagram and TikTok profiles link to (owner
 * decision, 2026-11-27; /ig and /tt redirect here with their tags).
 *
 * Every reel ends with "Full episode: link in bio.", so the first screen of
 * a phone shows the latest episode and a "Watch on YouTube" button. Below:
 * every episode out so far, the archetype quiz and the newsletter sign-up.
 *
 * Episodes appear by themselves at their release time: the loader picks the
 * episodes that are out (domain/youtube-episodes.server.ts) and the CDN keeps
 * the page for five minutes at most. Nothing about an episode not yet out
 * reaches the page or the browser. How to add episodes:
 * docs/social-landing.md.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { data, useLoaderData } from "react-router";

import type { Route } from "./+types/start";
import { BeehiivSignup } from "../components/beehiiv-signup";
import { GaugeMark } from "../components/gauge-mark";
import { NO_STORE } from "../domain/cache-policy";
import { withCampaignTags } from "../domain/campaign-tags";
import {
  startPageCacheControl,
  startPageEpisodes,
} from "../domain/youtube-episodes.server";
import "../styles/home.css";
import "../styles/start.css";

export function meta(): ReturnType<Route.MetaFunction> {
  return [
    { title: "The Reserve · Episodes" },
    {
      name: "description",
      content:
        "Documentaries about who actually owns the name on the dial. Every episode, a four-question watch quiz and the newsletter.",
    },
  ];
}

export const links: Route.LinksFunction = () => [
  // The episode cover comes from YouTube's image server.
  { rel: "preconnect", href: "https://i.ytimg.com" },
];

export function headers({
  loaderHeaders,
  errorHeaders,
}: Route.HeadersArgs): Headers {
  if (errorHeaders !== undefined) {
    return new Headers({ "Cache-Control": NO_STORE });
  }
  return new Headers(loaderHeaders);
}

export function loader({ request }: Route.LoaderArgs) {
  const now = new Date();
  return data(
    {
      ...startPageEpisodes(now),
      // A visit from a profile still counts for it once the visitor opens
      // the quiz (domain/campaign-tags.ts).
      archetypeHref: withCampaignTags("/watches/archetype", request.url),
    },
    { headers: { "Cache-Control": startPageCacheControl(now) } },
  );
}

const watchUrl = (youtubeId: string) =>
  `https://www.youtube.com/watch?v=${youtubeId}`;

/** "EP03": how clicks on each episode are named in /admin/analytics. */
const episodeCode = (episode: number) =>
  `EP${String(episode).padStart(2, "0")}`;

/**
 * YouTube's large cover, or its smaller one when a video has no large
 * cover: YouTube then answers with a 120-pixel grey placeholder rather than
 * an error, so the width is checked as well.
 */
function EpisodeCover({ youtubeId }: { youtubeId: string }) {
  const large = `https://i.ytimg.com/vi/${youtubeId}/maxresdefault.jpg`;
  const small = `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`;
  const [src, setSrc] = useState(large);
  const image = useRef<HTMLImageElement>(null);
  const check = useCallback(
    (element: HTMLImageElement) => {
      if (element.complete && element.naturalWidth <= 120) setSrc(small);
    },
    [small],
  );
  // The cover may have finished loading before the page became interactive.
  useEffect(() => {
    if (image.current) check(image.current);
  }, [check]);
  return (
    <img
      alt=""
      decoding="async"
      fetchPriority="high"
      height={720}
      onError={() => setSrc(small)}
      onLoad={(event) => check(event.currentTarget)}
      ref={image}
      src={src}
      width={1280}
    />
  );
}

export default function Start() {
  const { latest, episodes, firstEpisodeDay, channelUrl, archetypeHref } =
    useLoaderData<typeof loader>();

  return (
    <div className="site-shell start-shell">
      <main className="start" id="main-content">
        <header className="start-header">
          <div className="start-brand">
            <GaugeMark />
            <h1>The Reserve</h1>
          </div>
          <p className="start-manifesto">
            We investigate the filings, the balance sheets, and who actually
            owns the name on the dial.
          </p>
        </header>

        {latest ? (
          <section className="start-latest" aria-labelledby="latest-heading">
            {/* The cover repeats the button below, so it is hidden from
                screen readers and the keyboard. */}
            <a
              aria-hidden="true"
              className="start-latest__cover"
              data-analytics-control={`Episode cover · ${episodeCode(latest.episode)}`}
              href={watchUrl(latest.youtubeId)}
              tabIndex={-1}
            >
              <EpisodeCover
                key={latest.youtubeId}
                youtubeId={latest.youtubeId}
              />
              <span className="start-latest__play" />
            </a>
            <div className="start-latest__body">
              <span className="start-kicker">
                Latest episode · Episode {latest.episode}
              </span>
              <h2 id="latest-heading">{latest.title}</h2>
              <a
                className="start-button"
                data-analytics-control={`Watch on YouTube · ${episodeCode(latest.episode)}`}
                href={watchUrl(latest.youtubeId)}
              >
                Watch on YouTube
              </a>
            </div>
          </section>
        ) : (
          <section
            className="start-latest start-latest--soon"
            aria-labelledby="latest-heading"
          >
            <div className="start-latest__body">
              <span className="start-kicker">Documentaries on YouTube</span>
              <h2 id="latest-heading">
                {firstEpisodeDay
                  ? `First episode: ${firstEpisodeDay}`
                  : "Episodes on YouTube"}
              </h2>
              <a
                className="start-button"
                data-analytics-control="YouTube channel · before the first episode"
                href={channelUrl}
              >
                Open the YouTube channel
              </a>
            </div>
          </section>
        )}

        {episodes.length > 0 ? (
          <section
            className="start-episodes"
            aria-labelledby="episodes-heading"
          >
            <h2 className="start-section-label" id="episodes-heading">
              All episodes
            </h2>
            <ul className="start-list">
              {episodes.map((episode) => (
                <li key={episode.episode}>
                  <a
                    data-analytics-control={`Episode list · ${episodeCode(episode.episode)}`}
                    href={watchUrl(episode.youtubeId)}
                  >
                    <span className="start-list__number">
                      Episode {episode.episode}
                    </span>
                    <span className="start-list__title">{episode.title}</span>
                  </a>
                </li>
              ))}
            </ul>
            <a
              className="start-channel"
              data-analytics-control="YouTube channel"
              href={channelUrl}
            >
              The Reserve on YouTube →
            </a>
          </section>
        ) : null}

        <a className="landing-action start-quiz" href={archetypeHref}>
          <span className="landing-action__kicker">
            Four questions · No sign-up
          </span>
          <strong>Find your watch archetype</strong>
          <span className="landing-action__description">
            Four quick questions reveal the kind of collector you are, with ten
            watches that suit you at your price.
          </span>
          <span className="landing-action__footer">Take the quiz →</span>
        </a>

        {/* The home page's sign-up, sent to the home page's action. */}
        <BeehiivSignup action="/?index" />
      </main>

      <footer className="site-footer">
        <span>thereserve.watch</span>
        <a href="/privacy">Privacy policy</a>
      </footer>
    </div>
  );
}

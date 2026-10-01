import { Suspense, useEffect, useRef, useState } from "react";
import { Await } from "react-router";

import { YouTubeCallout } from "./youtube-callout";
import type {
  AiSearchView,
  FoundWatch,
  ProgressEvent,
  ProgressLink,
} from "../domain/ai-watch-types";
import { convert, formatMoney, type FxTable } from "../domain/fx";
import { QUIZ_SHOWN_FIRST } from "../domain/watch-catalogue";

type Mode = "quiz" | "film";

const SITE_CURRENCY = "USD";

const PROGRESS_STEPS: Record<Mode, { after: number; text: string }[]> = {
  quiz: [
    { after: 0, text: "Filtering the catalogue for every answer…" },
    { after: 2, text: "Searching live for watches that fit every answer…" },
    { after: 5, text: "Checking price, size, water resistance and materials…" },
    {
      after: 9,
      text: "Confirming each reference on the manufacturer's own page…",
    },
    { after: 18, text: "Still confirming the last references…" },
  ],
  film: [
    { after: 0, text: "Searching films, series and interviews…" },
    { after: 6, text: "Cross-checking each sighting against its source…" },
    { after: 12, text: "Finding a photo of each watch…" },
  ],
};

/** Reads the server's live feed of search steps as each one arrives. */
function useProgressFeed(
  feed: Promise<ProgressLink | null> | null | undefined,
) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  useEffect(() => {
    if (!feed) return;
    let active = true;
    void (async () => {
      try {
        for (let link = await feed; link && active; link = await link.next) {
          const event = link.event;
          setEvents((current) => [...current, event]);
        }
      } catch {
        // A broken stream only stops the live steps; the result still loads.
      }
    })();
    return () => {
      active = false;
    };
  }, [feed]);
  return events;
}

function SearchProgress({
  mode,
  progress,
  displayCurrency,
  fx,
}: {
  mode: Mode;
  progress?: Promise<ProgressLink | null> | null;
  displayCurrency: string;
  fx: FxTable | null;
}) {
  const [seconds, setSeconds] = useState(0);
  const events = useProgressFeed(progress);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1_000)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, []);
  // Until the first real step arrives, a timed hint keeps the page alive.
  const fallback = [...PROGRESS_STEPS[mode]]
    .reverse()
    .find((entry) => seconds >= entry.after)!;
  const current = events.at(-1)?.text ?? fallback.text;
  const earlier = events.slice(0, -1).slice(-5);
  const confirmed = events.flatMap((event) =>
    event.watch ? [event.watch] : [],
  );
  return (
    <div className="search-progress" role="status" aria-live="polite">
      <p>
        <span className="search-progress__pulse" aria-hidden="true" />
        {current} <span className="search-progress__time">{seconds} s</span>
      </p>
      {earlier.length > 0 ? (
        <ol className="search-progress__steps" aria-label="Search steps so far">
          {earlier.map((event, index) => (
            <li key={`${index}-${event.text}`}>{event.text}</li>
          ))}
        </ol>
      ) : null}
      {confirmed.length > 0 ? (
        <>
          <p className="search-progress__found">
            Confirmed so far; the final order may change.
          </p>
          <div className="watch-list">
            {confirmed.map((watch, index) => (
              <WatchCard
                displayCurrency={displayCurrency}
                fx={fx}
                key={`${watch.brand}-${watch.referenceCode ?? watch.model}-${index}`}
                mode={mode}
                rank={index + 1}
                watch={watch}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="watch-list" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div className="watch-card watch-card--skeleton" key={index}>
              <div className="watch-card__image" />
              <div className="watch-card__body">
                <span />
                <span />
                <span />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WatchImage({ watch }: { watch: FoundWatch }) {
  const [failed, setFailed] = useState(false);
  // A photo that failed before the page's scripts loaded never fires
  // onError, and the browser shows its alt text (the watch name again)
  // instead: check once on mount and show the placeholder.
  const image = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const element = image.current;
    if (element?.complete && element.naturalWidth === 0) setFailed(true);
  }, []);
  if (!watch.imageUrl || failed) {
    return (
      <div
        aria-hidden="true"
        className="watch-card__image watch-card__image--empty"
      >
        <span>{watch.brand}</span>
      </div>
    );
  }
  return (
    <img
      alt={`${watch.brand} ${watch.model}`}
      className="watch-card__image"
      decoding="async"
      loading="lazy"
      onError={() => setFailed(true)}
      ref={image}
      referrerPolicy="no-referrer"
      src={watch.imageUrl}
    />
  );
}

function PriceLine({
  watch,
  displayCurrency,
  fx,
}: {
  watch: FoundWatch;
  displayCurrency: string;
  fx: FxTable | null;
}) {
  const price = watch.details.price;
  // Prices come from web searches and can be out of date or wrong: every
  // card says so, and a card without a price says that too.
  if (!price) {
    return <span className="price-tag">Price not available</span>;
  }
  const converted =
    price.currency === displayCurrency || !fx
      ? null
      : convert(price.amount, price.currency, displayCurrency, fx);
  return (
    <>
      <strong className="watch-card__price">
        {converted === null
          ? formatMoney(price.amount, price.currency)
          : `≈ ${formatMoney(converted, displayCurrency)}`}
      </strong>
      <span className="price-tag">
        {watch.details.priceCondition === "pre-owned"
          ? "Pre-owned from established dealers, approximate"
          : "Approximate price, may be wrong"}
      </span>
    </>
  );
}

const MOVEMENT_LABELS: Record<string, string> = {
  automatic: "Automatic",
  manual: "Hand-wound",
  quartz: "Quartz",
  solar: "Solar",
  spring_drive: "Spring Drive",
  hybrid: "Hybrid",
};

/**
 * Film sightings link to where they were documented (owner decision,
 * 2026-10-01: 91% of these links checked live, unlike the catalogue's
 * AI-written maker URLs). Only plain web addresses are ever linked.
 */
function sourceLink(watch: FoundWatch) {
  const url = watch.details.evidenceUrl ?? watch.sourceUrl;
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "source";
  }
}

function WatchCard({
  watch,
  rank,
  mode,
  displayCurrency,
  fx,
  unconfirmedReference = false,
}: {
  watch: FoundWatch;
  rank: number;
  mode: Mode;
  displayCurrency: string;
  fx: FxTable | null;
  unconfirmedReference?: boolean;
}) {
  const details = watch.details;
  const facts =
    mode === "quiz"
      ? [
          details.caseDiameterMm ? `${details.caseDiameterMm} mm` : null,
          details.waterResistanceM ? `${details.waterResistanceM} m` : null,
          details.movement
            ? (MOVEMENT_LABELS[details.movement] ?? details.movement)
            : null,
        ].filter((fact): fact is string => fact !== null)
      : [];
  const eyebrow =
    mode === "film"
      ? [details.person, details.work, details.year]
          .filter(Boolean)
          .join(" · ") || "Documented sighting"
      : unconfirmedReference
        ? "Also worth a look"
        : details.misses && details.misses.length > 0
          ? `Option ${rank} · Close fit`
          : rank === 1
            ? "Best fit"
            : `Option ${rank}`;

  return (
    <article className="watch-card">
      <WatchImage watch={watch} />
      <div className="watch-card__body">
        <span className="eyebrow">{eyebrow}</span>
        <h3>
          {watch.brand} {watch.model}
        </h3>
        <div className="watch-card__meta">
          {watch.referenceCode ? <span>Ref. {watch.referenceCode}</span> : null}
          {mode === "quiz" ? (
            <PriceLine
              displayCurrency={displayCurrency}
              fx={fx}
              watch={watch}
            />
          ) : null}
        </div>
        {facts.length > 0 ? (
          <ul className="watch-card__facts" aria-label="Key facts">
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        ) : null}
        <p className="watch-card__rationale">{watch.rationale}</p>
        {mode === "film" && sourceLink(watch) ? (
          <a
            className="watch-card__source"
            href={sourceLink(watch)!}
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            Source: {hostOf(sourceLink(watch)!)}
          </a>
        ) : null}
        <div className="watch-card__footer">
          {details.misses?.map((miss) => (
            <span className="review-badge review-badge--warning" key={miss}>
              {miss}
            </span>
          ))}
          {details.reviewStatus === "pending" ? (
            <span className="review-badge">Not yet reviewed</span>
          ) : null}
          {/* Every catalogue-style card says when no maker's or authorised
              retailer's page confirmed its reference (owner decision). */}
          {unconfirmedReference ||
          (mode === "quiz" && details.referenceVerified !== true) ? (
            <span className="review-badge review-badge--warning">
              Manufacturer reference not confirmed
            </span>
          ) : null}
          {details.referenceVerified ? (
            <span className="verified-badge">
              Reference confirmed on the{" "}
              {details.sourceKind === "retailer"
                ? "authorised retailer's"
                : "manufacturer's"}{" "}
              page
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ResultBody({
  result,
  mode,
  displayCurrency,
  fx,
}: {
  result: AiSearchView;
  mode: Mode;
  displayCurrency: string;
  fx: FxTable | null;
}) {
  const [showAll, setShowAll] = useState(false);
  if (result.status === "unavailable") {
    return (
      <p className="empty-result">
        The search is unavailable right now. Please try again in a minute.
        Meanwhile, <a href="/watches">Watches from movies</a> and the{" "}
        <a href="/watches/archetype">archetype quiz</a> work as usual.
      </p>
    );
  }
  if (result.status === "no_match") {
    return <p className="empty-result">{result.summary}</p>;
  }
  return (
    <>
      <p className="result-summary">
        {result.summary}
        {result.origin === "catalogue" ? (
          <span className="result-summary__cached">
            {" "}
            Instant: from the catalogue.
          </span>
        ) : result.fromCache ? (
          <span className="result-summary__cached">
            {" "}
            Instant: answered before.
          </span>
        ) : null}
      </p>
      {result.watches.length > 0 ? (
        <div className="watch-list">
          {(showAll || mode !== "quiz"
            ? result.watches
            : result.watches.slice(0, QUIZ_SHOWN_FIRST)
          ).map((watch, index) => (
            <WatchCard
              displayCurrency={displayCurrency}
              fx={fx}
              key={`${watch.brand}-${watch.model}-${watch.referenceCode ?? ""}-${index}`}
              mode={mode}
              rank={index + 1}
              watch={watch}
            />
          ))}
        </div>
      ) : null}
      {mode === "quiz" &&
      !showAll &&
      result.watches.length > QUIZ_SHOWN_FIRST ? (
        <button
          className="button button--quiet show-all-watches"
          onClick={() => setShowAll(true)}
          type="button"
        >
          Show all {result.watches.length} watches
        </button>
      ) : null}
      {result.alsoWorth && result.alsoWorth.length > 0 ? (
        <section className="also-worth" aria-labelledby="also-worth-heading">
          <h3 id="also-worth-heading">Also worth a look</h3>
          <p className="result-footnote">
            These fit every answer too, but no manufacturer or
            authorised-retailer page confirmed their exact reference. Check the
            reference with the seller.
          </p>
          <div className="watch-list">
            {result.alsoWorth.map((watch, index) => (
              <WatchCard
                displayCurrency={displayCurrency}
                fx={fx}
                key={`also-${watch.brand}-${watch.model}-${watch.referenceCode ?? ""}-${index}`}
                mode={mode}
                rank={index + 1}
                unconfirmedReference
                watch={watch}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Renders a finished result or streams one in while the search runs. */
export function WatchResults({
  result,
  mode,
  heading,
  eyebrow,
  fx,
  footnote,
  progress,
}: {
  result: AiSearchView | Promise<AiSearchView>;
  /** The live steps of a running search, when the server sends them. */
  progress?: Promise<ProgressLink | null> | null;
  mode: Mode;
  heading: string;
  eyebrow: string;
  fx: FxTable | null;
  footnote?: string;
}) {
  // Every price on the site is shown in US dollars (owner decision),
  // converted from other currencies with the day's ECB reference rates.
  const displayCurrency = SITE_CURRENCY;
  return (
    <section className="ai-results" aria-labelledby="ai-results-heading">
      <div className="result-section-heading">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2 id="ai-results-heading">{heading}</h2>
        </div>
      </div>
      <Suspense
        fallback={
          <SearchProgress
            displayCurrency={displayCurrency}
            fx={fx}
            mode={mode}
            progress={progress}
          />
        }
      >
        <Await
          errorElement={
            <p className="empty-result">
              The search is unavailable right now. Please try again in a minute.
            </p>
          }
          resolve={result}
        >
          {(resolved) => (
            <ResultBody
              displayCurrency={displayCurrency}
              fx={fx}
              mode={mode}
              result={resolved}
            />
          )}
        </Await>
      </Suspense>
      {footnote ? <p className="result-footnote">{footnote}</p> : null}
      <YouTubeCallout variant="panel" />
    </section>
  );
}

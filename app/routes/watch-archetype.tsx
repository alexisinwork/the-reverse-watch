import { useRef, useState } from "react";
import { Form, Link, useLoaderData } from "react-router";

import type { Route } from "./+types/watch-archetype";
import { DiscoveryAnalytics } from "../components/discovery-analytics";
import {
  ARCHETYPE_QUESTIONS,
  ARCHETYPE_SCORING_VERSION,
  buildArchetypeSharePath,
  buildCoreQuizHandoff,
  parseArchetypeSearch,
  type ArchetypeId,
} from "../domain/discovery-archetype";
import { discoveryHandoffSchema } from "../domain/discovery-selection";
import { sendDiscoveryAnalyticsEvent } from "../domain/discovery-analytics";
import "../styles/discovery.css";

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const result = parseArchetypeSearch(url.searchParams);
  const configuredAppUrl = process.env.APP_URL?.trim();
  let publicOrigin = url.origin;

  if (configuredAppUrl) {
    try {
      const configuredOrigin = new URL(configuredAppUrl);
      if (["http:", "https:"].includes(configuredOrigin.protocol)) {
        publicOrigin = configuredOrigin.origin;
      }
    } catch {
      // Keep the request origin when the optional canonical origin is invalid.
    }
  }

  return {
    result,
    shareUrl:
      result.status === "complete"
        ? new URL(
            buildArchetypeSharePath(result.answers, result.scoringVersion),
            publicOrigin,
          ).toString()
        : null,
  };
}

export function meta() {
  return [
    { title: "Watch archetype · The Reserve" },
    {
      name: "description",
      content:
        "A four-question editorial watch archetype, followed by The Reserve's evidence-led diagnostic.",
    },
  ];
}

function ShareButton({
  archetypeId,
  shareUrl,
  title,
}: {
  archetypeId: ArchetypeId;
  shareUrl: string;
  title: string;
}) {
  const [status, setStatus] = useState("");
  const [showManualLink, setShowManualLink] = useState(false);

  const copyWithBrowserFallback = () => {
    const copyTarget = document.createElement("textarea");
    copyTarget.value = shareUrl;
    copyTarget.readOnly = true;
    copyTarget.setAttribute("aria-hidden", "true");
    copyTarget.style.position = "fixed";
    copyTarget.style.inset = "0 auto auto -9999px";
    document.body.append(copyTarget);

    try {
      copyTarget.select();
      copyTarget.setSelectionRange(0, copyTarget.value.length);
      return (
        typeof document.execCommand === "function" &&
        document.execCommand("copy")
      );
    } finally {
      copyTarget.remove();
    }
  };

  const share = async () => {
    setShowManualLink(false);

    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(shareUrl);
          copied = true;
        } catch {
          copied = copyWithBrowserFallback();
        }
      } else {
        copied = copyWithBrowserFallback();
      }
      if (!copied) throw new Error("The browser rejected the copy command.");

      sendDiscoveryAnalyticsEvent({ name: "share", archetypeId });
      setStatus(`Link to ${title} copied.`);
    } catch {
      setShowManualLink(true);
      setStatus("Automatic copy is unavailable. Copy the link shown below.");
    }
  };

  return (
    <div className="archetype-share">
      <button type="button" onClick={() => void share()}>
        Share this result
      </button>
      <p aria-live="polite">{status}</p>
      {showManualLink ? (
        <div className="archetype-share-manual">
          <label htmlFor="archetype-share-url">Shareable result link</label>
          <input
            id="archetype-share-url"
            onFocus={(event) => event.currentTarget.select()}
            readOnly
            value={shareUrl}
          />
          <a href={shareUrl}>Open the shareable result</a>
        </div>
      ) : null}
    </div>
  );
}

export default function WatchArchetype() {
  const { result, shareUrl } = useLoaderData<typeof loader>();
  const startTracked = useRef(false);

  const recordStart = () => {
    if (startTracked.current) return;
    startTracked.current = true;
    sendDiscoveryAnalyticsEvent({ name: "archetype_start" });
  };

  return (
    <main className="discovery-shell archetype-shell">
      <DiscoveryAnalytics event={{ name: "page_view", surface: "archetype" }} />
      {result.status === "complete" ? (
        <DiscoveryAnalytics
          event={{
            name: "archetype_completion",
            archetypeId: result.archetype.id,
          }}
        />
      ) : null}
      <nav className="discovery-nav" aria-label="Discovery navigation">
        <Link to="/watches">Watches of Celebrity &amp; Cinema</Link>
        <Link to="/quiz">Reference diagnostic</Link>
      </nav>

      {result.status === "complete" ? (
        <>
          <header className="discovery-header archetype-result-header">
            <span className="eyebrow">Editorial archetype</span>
            <h1>{result.archetype.title}</h1>
            <p>{result.archetype.strapline}</p>
          </header>
          <section
            className={`archetype-card archetype-card-${result.archetype.id}`}
            aria-labelledby="archetype-card-title"
          >
            <div className="archetype-mark" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <span>The Reserve · watch disposition no. 01</span>
            <h2 id="archetype-card-title">{result.archetype.title}</h2>
            <p>{result.archetype.strapline}</p>
            <small>{result.archetype.accent}</small>
          </section>
          <div className="archetype-reading">
            <p>{result.archetype.description}</p>
            <p>
              This is an editorial direction, not a claim that you are—or
              resemble—any public figure or fictional character.
            </p>
          </div>
          {shareUrl ? (
            <ShareButton
              archetypeId={result.archetype.id}
              shareUrl={shareUrl}
              title={result.archetype.title}
            />
          ) : null}
          <aside className="discovery-cta" aria-labelledby="archetype-next">
            <h2 id="archetype-next">Choose your next direction</h2>
            <p>
              The full diagnostic carries forward only the validated social and
              aesthetic preferences. It still asks you to confirm exact budget,
              wrist size, operating context, and every active hard constraint.
            </p>
            <div className="archetype-next-actions">
              <Link
                onClick={() =>
                  sendDiscoveryAnalyticsEvent({
                    name: "core_handoff",
                    archetypeId: result.archetype.id,
                  })
                }
                to={buildCoreQuizHandoff(result.answers)}
              >
                Find the right watch for me
              </Link>
              <Link
                to={`/watches/find?${new URLSearchParams(discoveryHandoffSchema.parse({ socialSignal: result.answers.socialSignal, aestheticDna: result.answers.aestheticDna })).toString()}`}
              >
                Find a watch from film and culture
              </Link>
            </div>
          </aside>
          <p className="archetype-boundary">
            No email is required for this result. Newsletter and dossier consent
            remain separate, explicit choices in the full diagnostic.
          </p>
          <Link className="archetype-retake" to="/watches/archetype">
            Retake the archetype quiz
          </Link>
          <Link className="archetype-retake" to="/watches">
            Browse the archive
          </Link>
        </>
      ) : (
        <>
          <header className="discovery-header">
            <span className="eyebrow">Four questions · no email</span>
            <h1>Your watch disposition</h1>
            <p>
              An editorial compass, not a recommendation. The full diagnostic
              applies budget, wrist, and technical constraints afterwards.
            </p>
          </header>
          {result.status === "invalid" ? (
            <p className="archetype-error" role="alert">
              That shared result is incomplete or invalid. Answer the four
              questions to generate a fresh one.
            </p>
          ) : null}
          <Form className="archetype-form" method="get" onChange={recordStart}>
            <input
              name="scoringVersion"
              type="hidden"
              value={ARCHETYPE_SCORING_VERSION}
            />
            {ARCHETYPE_QUESTIONS.map((question, questionIndex) => (
              <fieldset key={question.name}>
                <legend>
                  <span className="archetype-question-number">
                    {String(questionIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="archetype-question-title">
                    {question.legend}
                  </span>
                </legend>
                {"hint" in question ? <p>{question.hint}</p> : null}
                <div className="archetype-options">
                  {question.options.map(([value, label]) => (
                    <label key={value}>
                      <input
                        name={question.name}
                        type="radio"
                        value={value}
                        required
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <button type="submit">Reveal editorial archetype</button>
          </Form>
          <p className="archetype-boundary">
            Your answers stay in the shareable URL. This step does not request
            or submit an email address.
          </p>
        </>
      )}
    </main>
  );
}

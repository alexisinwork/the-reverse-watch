export const YOUTUBE_CHANNEL_URL = "https://www.youtube.com/@TheReserveWatch";

/**
 * The invitation to The Reserve's YouTube channel: a quiet line at the foot
 * of every page, and a more visible panel under search results.
 */
export function YouTubeCallout({
  variant = "footer",
}: {
  variant?: "footer" | "panel";
}) {
  if (variant === "panel") {
    return (
      <aside className="youtube-panel" aria-label="The Reserve on YouTube">
        <div>
          <strong>Curious about the stories behind these watches?</strong>
          <p>
            We make documentaries about watches, their makers and the people who
            wore them.
          </p>
        </div>
        <a
          className="button button--quiet"
          href={YOUTUBE_CHANNEL_URL}
          rel="noopener noreferrer"
          target="_blank"
        >
          Watch on YouTube
        </a>
      </aside>
    );
  }
  // An aside, not a <footer>: pages have their own footer, and screen
  // readers expect a single page footer (contentinfo landmark).
  return (
    <aside aria-label="Our YouTube channel" className="youtube-footer">
      <p>
        Curious about watches?{" "}
        <a href={YOUTUBE_CHANNEL_URL} rel="noopener noreferrer" target="_blank">
          Check our YouTube channel
        </a>
        . <a href="/privacy">Privacy policy</a>
      </p>
    </aside>
  );
}

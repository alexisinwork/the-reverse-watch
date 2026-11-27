import { useState } from "react";

/**
 * Exclusive Watch Selection: the paid, personal watch selection planned after
 * the launch (owner, 2026-11-27: "подготовь сразу плашку на всех end pages
 * disabled feature Exclusive Watch подбор часов"). It sits under every result
 * screen of The Reserve's own site, never inside a partner widget, and takes
 * no order, payment or email yet. A press on its button counts as interest in
 * the site's own analytics (control "exclusive_selection" on
 * /admin/analytics), so demand can be measured before it opens.
 */
export function ExclusiveSelectionTeaser() {
  const [pressed, setPressed] = useState(false);
  return (
    <aside
      aria-labelledby="exclusive-selection-title"
      className="exclusive-panel"
    >
      <div>
        <span className="eyebrow">Coming soon</span>
        <strong id="exclusive-selection-title">
          Exclusive Watch Selection
        </strong>
        <p>
          A personal shortlist for your exact brief, with every fact checked on
          the makers&rsquo; own pages and the trade-offs explained.
        </p>
        {pressed ? (
          <p className="exclusive-panel__note" role="status">
            Not open yet. We will announce it on our YouTube channel.
          </p>
        ) : null}
      </div>
      <button
        aria-disabled="true"
        className="button button--quiet exclusive-panel__button"
        data-analytics-control="exclusive_selection"
        onClick={() => setPressed(true)}
        type="button"
      >
        Coming soon
      </button>
    </aside>
  );
}

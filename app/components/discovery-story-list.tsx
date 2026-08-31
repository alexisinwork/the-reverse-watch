import { Link } from "react-router";

import type { PublishedDiscoveryStory } from "../domain/discovery-public";

export function DiscoveryStoryList({
  stories,
}: {
  stories: PublishedDiscoveryStory[];
}) {
  return (
    <div className="discovery-grid">
      {stories.map((story) => (
        <article className="discovery-card" key={story.slug}>
          <span
            className={`confidence confidence-${story.attribution.confidence}`}
          >
            {story.attribution.confidenceLabel}
          </span>
          <h2>
            <Link to={`/watches/stories/${story.slug}`}>{story.headline}</Link>
          </h2>
          <p>{story.summary}</p>
          <dl>
            <div>
              <dt>Subject</dt>
              <dd>{story.entity.name}</dd>
            </div>
            <div>
              <dt>Identification</dt>
              <dd>
                {[story.attribution.brand, story.attribution.model]
                  .filter(Boolean)
                  .join(" · ") || "Not identified"}
              </dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}

import { useEffect } from "react";

import {
  sendDiscoveryAnalyticsEvent,
  type DiscoveryAnalyticsEvent,
} from "../domain/discovery-analytics";

export function DiscoveryAnalytics({
  event,
}: {
  event: DiscoveryAnalyticsEvent;
}) {
  const serialized = JSON.stringify(event);
  useEffect(() => {
    sendDiscoveryAnalyticsEvent(
      JSON.parse(serialized) as DiscoveryAnalyticsEvent,
    );
  }, [serialized]);
  return null;
}

import { useSyncExternalStore } from "react";

import { FIRST_TOUCH_FIELDS } from "../domain/first-touch";
import { currentFirstTouch } from "../domain/interaction-analytics";

const noSubscription = () => () => undefined;

/**
 * Hidden fields with how this tab's visit began, read in the browser (the
 * tab's sessionStorage is not on the server). The newsletter sign-up and the
 * quiz's email opt-in pass them to Beehiiv's utm_* fields; nothing else about
 * the visit is sent. Its own file, so the quiz page does not load the sign-up.
 */
export function FirstTouchFields() {
  // The server renders no fields; the browser fills them in on hydration.
  const touch = useSyncExternalStore(
    noSubscription,
    currentFirstTouch,
    () => undefined,
  );
  if (!touch) return null;
  return (
    <>
      <input
        name={FIRST_TOUCH_FIELDS.source}
        type="hidden"
        value={touch.source}
      />
      <input
        name={FIRST_TOUCH_FIELDS.medium}
        type="hidden"
        value={touch.medium}
      />
      {touch.campaign ? (
        <input
          name={FIRST_TOUCH_FIELDS.campaign}
          type="hidden"
          value={touch.campaign}
        />
      ) : null}
      <input
        name={FIRST_TOUCH_FIELDS.landing}
        type="hidden"
        value={touch.landing}
      />
    </>
  );
}

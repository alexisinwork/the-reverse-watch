/**
 * Messages from a partner widget to the page it sits on. public/embed.js
 * listens for them (resizing the frame, re-sending them as DOM events).
 * Nothing personal is ever sent: heights, paths and result counts only.
 */
import type { WidgetMessage } from "../domain/partner-sites";

export function postToHost(message: WidgetMessage) {
  if (typeof window === "undefined" || window.parent === window) return;
  // The host page's address isn't known inside the frame, and the message
  // holds nothing private, so any parent may read it.
  window.parent.postMessage(message, "*");
}

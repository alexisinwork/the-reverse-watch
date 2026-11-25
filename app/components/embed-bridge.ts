/**
 * Messages from a partner widget to the page it sits on. public/embed.js
 * listens for them (resizing the frame, re-sending them as DOM events).
 * Nothing personal is ever sent: heights, paths and result counts only.
 */
import type { WidgetMessage } from "../domain/partner-sites";

/**
 * Sends to the partner's registered websites only. Only those may frame the
 * widget (frame-ancestors), and the browser drops a message whose target
 * does not match the parent, so the one real parent receives it and no
 * other page could, even if the framing rule were ever relaxed.
 */
export function postToHost(
  message: WidgetMessage,
  parentOrigins: readonly string[],
) {
  if (typeof window === "undefined" || window.parent === window) return;
  for (const origin of parentOrigins) {
    try {
      window.parent.postMessage(message, origin);
    } catch {
      // A malformed stored origin cannot be a target; skip it.
    }
  }
}

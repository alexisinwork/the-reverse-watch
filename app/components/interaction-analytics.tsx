import { useEffect } from "react";
import { useLocation } from "react-router";
import {
  sendInteraction,
  interactionPagePath,
} from "../domain/interaction-analytics";

function controlFor(element: HTMLElement) {
  const explicit = element.dataset.analyticsControl;
  if (explicit) return explicit;
  const labelled =
    element.getAttribute("aria-label") ?? element.getAttribute("title");
  if (labelled) return labelled;
  const label = element.closest("label");
  const field = element.matches("input,select,textarea")
    ? (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)
    : label?.control;
  if (field && "name" in field && typeof field.name === "string" && field.name)
    return `field:${field.name}`;
  return (element.innerText || element.textContent || element.tagName)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}
function targetFor(element: HTMLElement) {
  if (element instanceof HTMLAnchorElement) {
    try {
      const url = new URL(element.href, window.location.href);
      return url.origin === window.location.origin
        ? interactionPagePath(url.pathname)
        : url.hostname;
    } catch {
      return "link";
    }
  }
  return element.tagName.toLowerCase();
}
export function InteractionAnalytics() {
  const { pathname } = useLocation();
  useEffect(() => {
    if (pathname.startsWith("/admin")) return;
    sendInteraction("page_view");
  }, [pathname]);
  useEffect(() => {
    if (window.location.pathname.startsWith("/admin")) return;
    const click = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const element = target.closest<HTMLElement>("a,button,[role=button]");
      if (!element || element.closest("[data-analytics-ignore]")) return;
      sendInteraction("click", {
        control: controlFor(element),
        target: targetFor(element),
      });
    };
    document.addEventListener("click", click, true);
    return () => document.removeEventListener("click", click, true);
  }, []);
  return null;
}

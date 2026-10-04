/**
 * @thereserve/react — The Reserve's widgets as a React component. It loads
 * https://thereserve.watch/embed.js once and mounts the widget in a frame
 * that resizes to its content.
 *
 *   <ReserveWidget feature="quiz" publicKey="pk_live_…" scheme="light" />
 */
import { useEffect, useRef } from "react";

export type ReserveFeature =
  "quiz" | "archetype" | "find" | "alternatives" | "stories";

export type ReserveWidgetMessage = {
  type:
    "reserve:ready" | "reserve:resize" | "reserve:navigate" | "reserve:results";
  feature?: ReserveFeature;
  height?: number;
  path?: string;
  count?: number;
};

export type ReserveWidgetProps = {
  feature: ReserveFeature;
  publicKey: string;
  scheme?: "light" | "dark";
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
  font?: "system" | "serif";
  radius?: number;
  /** Start with a search, e.g. "type=actor&q=Daniel Craig". */
  params?: string;
  /** Height before the widget reports its own (px). */
  initialHeight?: number;
  /** ready, resize, navigate and results messages from the widget. */
  onMessage?: (message: ReserveWidgetMessage) => void;
  baseUrl?: string;
  className?: string;
};

type Loader = {
  mount: (
    element: HTMLElement,
    options: { feature: string; key: string },
  ) => unknown;
};

const MESSAGE_TYPES = [
  "reserve:ready",
  "reserve:resize",
  "reserve:navigate",
  "reserve:results",
] as const;

const loading = new Map<string, Promise<Loader>>();

function currentLoader() {
  return (window as Window & { TheReserve?: Loader }).TheReserve;
}

function loadEmbedScript(baseUrl: string): Promise<Loader> {
  const ready = currentLoader();
  if (ready) return Promise.resolve(ready);
  let pending = loading.get(baseUrl);
  if (!pending) {
    pending = new Promise<Loader>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${baseUrl}/embed.js`;
      script.async = true;
      script.onload = () => {
        const loader = currentLoader();
        if (loader) resolve(loader);
        else reject(new Error("The Reserve embed script did not start."));
      };
      script.onerror = () =>
        reject(new Error("The Reserve embed script failed to load."));
      document.head.append(script);
    });
    loading.set(baseUrl, pending);
  }
  return pending;
}

export function ReserveWidget({
  feature,
  publicKey,
  scheme,
  accent,
  background,
  surface,
  text,
  font,
  radius,
  params,
  initialHeight,
  onMessage,
  baseUrl = "https://thereserve.watch",
  className,
}: ReserveWidgetProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    // A fresh element per mount, so changed settings give a fresh widget.
    const slot = document.createElement("div");
    const settings: Record<string, string | number | undefined> = {
      scheme,
      accent,
      bg: background,
      surface,
      text,
      font,
      radius,
      params,
      height: initialHeight,
    };
    for (const [name, value] of Object.entries(settings)) {
      if (value !== undefined && value !== "")
        slot.setAttribute(`data-${name}`, String(value));
    }
    host.append(slot);
    const relay = (event: Event) =>
      onMessageRef.current?.(
        (event as CustomEvent<ReserveWidgetMessage>).detail,
      );
    for (const type of MESSAGE_TYPES) slot.addEventListener(type, relay);
    let cancelled = false;
    loadEmbedScript(baseUrl.replace(/\/$/, ""))
      .then((loader) => {
        if (!cancelled) loader.mount(slot, { feature, key: publicKey });
      })
      .catch((error: unknown) => {
        console.warn(error);
      });
    return () => {
      cancelled = true;
      for (const type of MESSAGE_TYPES) slot.removeEventListener(type, relay);
      slot.remove();
    };
  }, [
    feature,
    publicKey,
    scheme,
    accent,
    background,
    surface,
    text,
    font,
    radius,
    params,
    initialHeight,
    baseUrl,
  ]);

  return <div className={className} ref={ref} />;
}

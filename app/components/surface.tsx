/**
 * Where a page is shown: on The Reserve itself, or inside a partner's
 * widget (/embed/:key/…). Pages use these instead of plain links so the
 * same page works in both places: inside a widget, links to other widget
 * pages stay in the frame and keep the key and theme, and everything else
 * opens The Reserve in a new tab.
 */
import { createContext, useContext, type ReactNode } from "react";
import { Link, useLocation, useNavigation } from "react-router";

import {
  embedHref,
  THEME_PARAM_NAMES,
  type PartnerFeature,
} from "../domain/partner-sites";

export type EmbedSurface = {
  key: string;
  feature: PartnerFeature;
  /** The widget tag's theme overrides, kept on every page in the frame. */
  themeQuery: string;
  /** The Reserve's own address, for links that leave the widget. */
  siteOrigin: string;
};

const SurfaceContext = createContext<EmbedSurface | null>(null);

export const EmbedSurfaceProvider = SurfaceContext.Provider;

/** The widget this page is in, or null on The Reserve itself. */
export function useEmbed() {
  return useContext(SurfaceContext);
}

/** The address of a site page, as reached from where this page is shown. */
export function useSurfaceHref() {
  const embed = useEmbed();
  return (to: string) => (embed ? embedHref(to, embed).href : to);
}

export function SurfaceLink({
  to,
  children,
  className,
  onClick,
}: {
  to: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const embed = useEmbed();
  if (!embed) {
    return (
      <Link className={className} onClick={onClick} to={to}>
        {children}
      </Link>
    );
  }
  const { internal, href } = embedHref(to, embed);
  return internal ? (
    <Link className={className} onClick={onClick} to={href}>
      {children}
    </Link>
  ) : (
    <a
      className={className}
      href={href}
      onClick={onClick}
      rel="noopener"
      target="_blank"
    >
      {children}
    </a>
  );
}

/**
 * Hidden fields that keep the widget's theme when a search form is sent
 * (a GET form replaces the whole query string).
 */
export function EmbedThemeFields() {
  const embed = useEmbed();
  if (!embed) return null;
  const params = new URLSearchParams(embed.themeQuery);
  return (
    <>
      {[...params]
        .filter(([name]) => THEME_PARAM_NAMES.includes(name))
        .map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
    </>
  );
}

/** True while a GET search on this same page is loading. */
export function useSearchingHere() {
  const navigation = useNavigation();
  const location = useLocation();
  return (
    navigation.state === "loading" &&
    navigation.location?.pathname === location.pathname
  );
}

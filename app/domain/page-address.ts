/**
 * The page address a form was posted from. React Router posts forms to a
 * hidden data address (/admin/catalogue.data?...&_routes=...); redirecting
 * there would show the raw data instead of the page.
 */
export function pageAddress(requestUrl: string) {
  const url = new URL(requestUrl);
  url.searchParams.delete("_routes");
  const query = url.searchParams.toString();
  return `${url.pathname.replace(/\.data$/, "")}${query ? `?${query}` : ""}`;
}

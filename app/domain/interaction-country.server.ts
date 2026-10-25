/** Read only the hosting edge's two-letter country, never a client-sent location. */
export function interactionCountry(request: Request) {
  const value = request.headers
    .get("x-vercel-ip-country")
    ?.trim()
    .toUpperCase();
  return value && /^[A-Z]{2}$/.test(value) ? value : null;
}

/** Legacy calls may perform retries, fallback searches and unreported charges.
 * Keep them paused until each path uses the shared durable reservation and
 * settlement contract. Catalogue-only operations do not need this guard. */
export function legacyPaidResearchAllowed(): boolean {
  return false;
}

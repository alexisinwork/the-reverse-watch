import { emailProviderTimeoutSignal } from "./email-provider.server";

type Environment = Record<string, string | undefined>;

export type BeehiivConfiguration =
  | { configured: true; apiKey: string; publicationId: string }
  | { configured: false; reason: "missing" | "invalid" };

export function parseBeehiivConfiguration(
  environment: Environment = process.env,
): BeehiivConfiguration {
  const apiKey = environment.BEEHIIV_API_KEY?.trim();
  const publicationId = environment.BEEHIIV_PUBLICATION_ID?.trim();
  if (!apiKey && !publicationId)
    return { configured: false, reason: "missing" };
  if (!apiKey || !publicationId)
    return { configured: false, reason: "invalid" };
  return { configured: true, apiKey, publicationId };
}

export async function subscribeToBeehiiv(
  email: string,
  configuration: Extract<BeehiivConfiguration, { configured: true }>,
  fetchImplementation: typeof fetch = fetch,
) {
  const response = await fetchImplementation(
    `https://api.beehiiv.com/v2/publications/${encodeURIComponent(configuration.publicationId)}/subscriptions`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configuration.apiKey}`,
        "Content-Type": "application/json",
      },
      signal: emailProviderTimeoutSignal(),
      body: JSON.stringify({
        email,
        send_welcome_email: true,
        utm_source: "the_reserve_diagnostic",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Beehiiv subscription failed with HTTP ${response.status}`);
  }
}

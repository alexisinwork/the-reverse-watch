import { z } from "zod";

import { emailProviderTimeoutSignal } from "./email-provider.server";

type Environment = Record<string, string | undefined>;

export type BeehiivConfiguration =
  | { configured: true; apiKey: string; publicationId: string }
  | { configured: false; reason: "missing" | "invalid" };

const beehiivSubscriptionResponseSchema = z.object({
  data: z.object({
    id: z.string().startsWith("sub_"),
    email: z.string().trim().email(),
    status: z.string().trim().min(1).max(64),
  }),
});

export class BeehiivSubscriptionNotActiveError extends Error {
  constructor(readonly providerStatus: string) {
    super("Beehiiv did not activate the subscription");
    this.name = "BeehiivSubscriptionNotActiveError";
  }
}

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
        reactivate_existing: true,
        send_welcome_email: true,
        double_opt_override: "off",
        utm_source: "the_reserve_diagnostic",
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Beehiiv subscription failed with HTTP ${response.status}`);
  }

  const payload = beehiivSubscriptionResponseSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!payload.success) {
    throw new Error("Beehiiv subscription returned an invalid response");
  }
  if (payload.data.data.email.toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error("Beehiiv subscription returned an unexpected address");
  }
  if (payload.data.data.status !== "active") {
    throw new BeehiivSubscriptionNotActiveError(payload.data.data.status);
  }

  return { status: "active" as const };
}

/**
 * The optional email delivery after the quiz: the Beehiiv newsletter
 * opt-in and the Resend dossier email, each sent at most once per address
 * and answer set when Upstash is configured.
 */
import type { AiSearchView } from "./ai-watch-types";
import {
  parseBeehiivConfiguration,
  subscribeToBeehiiv,
} from "./beehiiv.server";
import { renderDossierEmail } from "./dossier-email";
import {
  createEmailDeliveryDeduplicationClient,
  emailDeliveryDeduplicationKey,
} from "./email-deduplication.server";
import {
  summarizeEmailDelivery,
  type DeliveryChannelStatus,
  type SubscriptionResult,
} from "./email-delivery";
import type { ProfileV4 } from "./questionnaire-v4";
import { parseUpstashRateLimitConfiguration } from "./rate-limit-upstash.server";
import {
  parseResendConfiguration,
  sendDossierWithResend,
} from "./resend.server";

/** Every submission is one complete profile: a qualified evaluation. */
export const SUBMISSION_INTENT = "core" as const;

export function logError(event: string, error: unknown) {
  console.error(
    JSON.stringify({
      event,
      message: error instanceof Error ? error.message : "unknown error",
    }),
  );
}

export async function deliverEmail(
  email: string,
  profile: ProfileV4,
  aiSearch: AiSearchView,
): Promise<SubscriptionResult> {
  const beehiivConfiguration = parseBeehiivConfiguration();
  const resendConfiguration = parseResendConfiguration();
  const upstashConfiguration = parseUpstashRateLimitConfiguration();
  const dossier = renderDossierEmail({ profile, aiSearch });
  const deduplicationClient =
    upstashConfiguration.configured &&
    (beehiivConfiguration.configured || resendConfiguration.configured)
      ? createEmailDeliveryDeduplicationClient(upstashConfiguration)
      : null;

  const deliver = async (
    channel: "newsletter" | "dossier",
    send: () => Promise<unknown>,
  ): Promise<DeliveryChannelStatus> => {
    const key = deduplicationClient
      ? emailDeliveryDeduplicationKey({
          channel,
          email,
          intent: SUBMISSION_INTENT,
          profile,
        })
      : null;
    if (!deduplicationClient || !key) {
      await send();
      return "sent";
    }
    let claimed: boolean;
    try {
      claimed = await deduplicationClient.claim(key);
    } catch (error) {
      logError("email_deduplication_error", error);
      return "failed";
    }
    if (!claimed) return "already_requested";
    try {
      await send();
      return "sent";
    } catch (error) {
      try {
        await deduplicationClient.release(key);
      } catch (releaseError) {
        logError("email_deduplication_error", releaseError);
      }
      throw error;
    }
  };

  let newsletterStatus: DeliveryChannelStatus = beehiivConfiguration.configured
    ? "failed"
    : beehiivConfiguration.reason === "invalid"
      ? "misconfigured"
      : "unavailable";
  let dossierStatus: DeliveryChannelStatus = resendConfiguration.configured
    ? "failed"
    : resendConfiguration.reason === "invalid"
      ? "misconfigured"
      : "unavailable";
  if (beehiivConfiguration.configured) {
    try {
      newsletterStatus = await deliver("newsletter", () =>
        subscribeToBeehiiv(email, beehiivConfiguration),
      );
    } catch (error) {
      logError("beehiiv_subscription_error", error);
    }
  }
  if (resendConfiguration.configured) {
    try {
      dossierStatus = await deliver("dossier", () =>
        sendDossierWithResend(email, dossier, resendConfiguration),
      );
    } catch (error) {
      logError("resend_dossier_error", error);
    }
  }
  return summarizeEmailDelivery(newsletterStatus, dossierStatus);
}

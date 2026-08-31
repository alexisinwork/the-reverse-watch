import type { DossierEmail } from "./dossier-email";
import { emailProviderTimeoutSignal } from "./email-provider.server";

type Environment = Record<string, string | undefined>;

export type ResendConfiguration =
  | { configured: true; apiKey: string; emailFrom: string }
  | { configured: false; reason: "missing" | "invalid" };

export function parseResendConfiguration(
  environment: Environment = process.env,
): ResendConfiguration {
  const apiKey = environment.RESEND_API_KEY?.trim();
  const emailFrom = environment.EMAIL_FROM?.trim();
  if (!apiKey && !emailFrom) return { configured: false, reason: "missing" };
  if (!apiKey || !emailFrom) return { configured: false, reason: "invalid" };
  return { configured: true, apiKey, emailFrom };
}

export async function sendDossierWithResend(
  email: string,
  dossier: DossierEmail,
  configuration: Extract<ResendConfiguration, { configured: true }>,
  fetchImplementation: typeof fetch = fetch,
) {
  const response = await fetchImplementation("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${configuration.apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "the-reserve-diagnostic",
    },
    signal: emailProviderTimeoutSignal(),
    body: JSON.stringify({
      from: configuration.emailFrom,
      to: [email],
      subject: dossier.subject,
      html: dossier.html,
      text: dossier.text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Resend email failed with HTTP ${response.status}`);
  }
}

export type DeliveryChannelStatus =
  "sent" | "unavailable" | "misconfigured" | "failed" | "already_requested";

export type EmailDeliverySummary = {
  status: "sent" | "partial" | "unavailable" | "failed" | "already_requested";
  message: string;
  newsletterStatus: DeliveryChannelStatus;
  dossierStatus: DeliveryChannelStatus;
};

export function summarizeEmailDelivery(
  newsletterStatus: DeliveryChannelStatus,
  dossierStatus: DeliveryChannelStatus,
): EmailDeliverySummary {
  const successfulChannels = [newsletterStatus, dossierStatus].filter(
    (status) => status === "sent",
  ).length;
  const failedChannels = [newsletterStatus, dossierStatus].filter(
    (status) => status === "failed" || status === "misconfigured",
  ).length;
  const alreadyRequestedChannels = [newsletterStatus, dossierStatus].filter(
    (status) => status === "already_requested",
  ).length;
  const status =
    failedChannels > 0
      ? successfulChannels > 0 || alreadyRequestedChannels > 0
        ? "partial"
        : "failed"
      : successfulChannels > 0
        ? "sent"
        : alreadyRequestedChannels > 0
          ? "already_requested"
          : "unavailable";
  const channelMessages = [
    newsletterStatus === "sent"
      ? "newsletter opt-in recorded"
      : newsletterStatus === "failed"
        ? "newsletter opt-in failed"
        : newsletterStatus === "misconfigured"
          ? "newsletter delivery misconfigured"
          : newsletterStatus === "already_requested"
            ? "newsletter delivery already requested"
            : "newsletter delivery unavailable",
    dossierStatus === "sent"
      ? "custom dossier sent"
      : dossierStatus === "failed"
        ? "custom dossier delivery failed"
        : dossierStatus === "misconfigured"
          ? "custom dossier delivery misconfigured"
          : dossierStatus === "already_requested"
            ? "custom dossier delivery already requested"
            : "custom dossier delivery unavailable",
  ];
  return {
    status,
    newsletterStatus,
    dossierStatus,
    message: `${channelMessages.join("; ")}. Your result remains available.`,
  };
}

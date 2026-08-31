export type DeliveryChannelStatus = "sent" | "unavailable" | "failed";

export type EmailDeliverySummary = {
  status: "sent" | "partial" | "unavailable" | "failed";
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
    (status) => status === "failed",
  ).length;
  const status =
    successfulChannels > 0
      ? failedChannels > 0
        ? "partial"
        : "sent"
      : failedChannels > 0
        ? "failed"
        : "unavailable";
  const channelMessages = [
    newsletterStatus === "sent"
      ? "newsletter opt-in recorded"
      : newsletterStatus === "failed"
        ? "newsletter opt-in failed"
        : "newsletter delivery unavailable",
    dossierStatus === "sent"
      ? "custom dossier sent"
      : dossierStatus === "failed"
        ? "custom dossier delivery failed"
        : "custom dossier delivery unavailable",
  ];
  return {
    status,
    newsletterStatus,
    dossierStatus,
    message: `${channelMessages.join("; ")}. Your result remains available.`,
  };
}

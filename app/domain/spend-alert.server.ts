// An email to the owner when paid checks pass a spend mark this month, and
// at once when the ledger halts them (owner, 2026-11-26: the limit stays
// $100 a month; "мне нужен емайл"; the Perplexity balance should be known
// in advance). Each mark is sent once a month: Redis claims it first.
import { Redis } from "@upstash/redis";

import type { Provider } from "./provider-spend.server";
import { spendMonth } from "./provider-spend.server";
import { parseResendConfiguration, senderWithName } from "./resend.server";
import { emailProviderTimeoutSignal } from "./email-provider.server";

/** Marks on the month's ledger spend (spent plus reserved), in USD. */
export const SPEND_ALERT_MARKS_USD = [5, 10, 25, 50, 75, 90, 100] as const;
/** Marks on the month's Perplexity charge alone, for its prepaid balance. */
export const PERPLEXITY_ALERT_MARKS_USD = [5, 10] as const;

export type LedgerStatus = {
  month: string;
  spentUsd: number;
  reservedUsd: number;
  limitUsd: number;
  halted: boolean;
  attempts: number;
};

/** Every mark the month's spend has reached, as stable claim names. */
export function reachedMarks(
  ledger: LedgerStatus,
  providers: Record<Provider, number | null>,
) {
  const used = ledger.spentUsd + ledger.reservedUsd;
  return [
    ...SPEND_ALERT_MARKS_USD.filter((mark) => used >= mark).map(
      (mark) => `ledger-${mark}`,
    ),
    ...PERPLEXITY_ALERT_MARKS_USD.filter(
      (mark) => (providers.perplexity ?? 0) >= mark,
    ).map((mark) => `perplexity-${mark}`),
    ...(ledger.halted ? ["halted"] : []),
  ];
}

const money = (value: number | null) =>
  value === null ? "нет данных" : `$${value.toFixed(2)}`;

/** One email naming every newly reached mark. */
export function spendAlertEmail(
  ledger: LedgerStatus,
  providers: Record<Provider, number | null>,
  marks: readonly string[],
) {
  const used = ledger.spentUsd + ledger.reservedUsd;
  const subject = ledger.halted
    ? "The Reserve: платные проверки остановлены"
    : `The Reserve: платные проверки за месяц — ${money(used)} из $${ledger.limitUsd}`;
  const lines = [
    ledger.halted
      ? "Журнал расходов остановил платные проверки: одна проверка стоила больше заложенного. Новые платные проверки не начнутся, пока это не разобрано."
      : `Платные проверки в этом месяце дошли до ${marks
          .filter((mark) => mark.startsWith("ledger-"))
          .map((mark) => `$${mark.slice(7)}`)
          .join(", ")} из лимита $${ledger.limitUsd}.`,
    "",
    `Месяц: ${ledger.month}`,
    `Потрачено: ${money(ledger.spentUsd)}, ещё зарезервировано: ${money(ledger.reservedUsd)}, попыток: ${ledger.attempts}`,
    `Из них Perplexity: ${money(providers.perplexity)}, Muse Spark: ${money(providers.muse)}`,
    "",
    marks.some((mark) => mark.startsWith("perplexity-"))
      ? "Perplexity списывает с предоплаченного баланса: проверьте баланс в кабинете Perplexity и пополните его, если осталось мало."
      : "Баланс Perplexity предоплачен: если он закончится, новые платные проверки перестанут проходить.",
    "Сайт сам не потратит больше $100 в месяц. Подробности: /admin/catalogue.",
  ];
  const text = lines.join("\n");
  const html = lines
    .map((line) =>
      line ? `<p>${line.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</p>` : "",
    )
    .join("");
  return { subject, text, html };
}

export type SpendAlertServices = {
  /** True the first time a mark is claimed this month. */
  claim: (month: string, mark: string) => Promise<boolean>;
  send: (email: ReturnType<typeof spendAlertEmail>) => Promise<void>;
};

/** Claims every reached mark and sends one email for the new ones. */
export async function runSpendAlert(
  ledger: LedgerStatus,
  providers: Record<Provider, number | null>,
  services: SpendAlertServices,
) {
  const fresh: string[] = [];
  for (const mark of reachedMarks(ledger, providers))
    if (await services.claim(ledger.month, mark)) fresh.push(mark);
  if (fresh.length === 0) return { sent: false as const, marks: [] };
  await services.send(spendAlertEmail(ledger, providers, fresh));
  return { sent: true as const, marks: fresh };
}

/** The production services: Upstash Redis claims, Resend delivery. */
export function spendAlertServices(
  environment: Record<string, string | undefined> = process.env,
): SpendAlertServices | null {
  const recipient = environment.SPEND_ALERT_EMAIL?.trim();
  const resend = parseResendConfiguration(environment);
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!recipient || !resend.configured || !url || !token) return null;
  const redis = new Redis({ url, token });
  return {
    claim: async (month, mark) =>
      (await redis.set(`the-reserve:spend-alert:${month}:${mark}`, "1", {
        nx: true,
        ex: 70 * 24 * 60 * 60,
      })) === "OK",
    send: async (email) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resend.apiKey}`,
          "Content-Type": "application/json",
        },
        signal: emailProviderTimeoutSignal(),
        body: JSON.stringify({
          from: senderWithName(resend.emailFrom),
          to: [recipient],
          subject: email.subject,
          text: email.text,
          html: email.html,
        }),
      });
      if (!response.ok)
        throw new Error(`Resend email failed with HTTP ${response.status}`);
    },
  };
}

export { spendMonth };

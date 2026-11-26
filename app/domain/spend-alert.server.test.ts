import { describe, expect, it, vi } from "vitest";

import {
  reachedMarks,
  runSpendAlert,
  spendAlertEmail,
  type LedgerStatus,
} from "./spend-alert.server";

const ledger = (spentUsd: number, halted = false): LedgerStatus => ({
  month: "2026-11-01",
  spentUsd,
  reservedUsd: 0,
  limitUsd: 100,
  halted,
  attempts: 120,
});
const providers = { perplexity: 6.2, muse: 4.1 };

describe("spend alerts", () => {
  it("names every mark the month has reached, Perplexity separately", () => {
    expect(reachedMarks(ledger(12), providers)).toEqual([
      "ledger-5",
      "ledger-10",
      "perplexity-5",
    ]);
    expect(
      reachedMarks(ledger(3, true), { perplexity: null, muse: null }),
    ).toEqual(["halted"]);
  });

  it("sends one email for the new marks and none for marks already sent", async () => {
    const claimed = new Set<string>(["2026-11-01:ledger-5"]);
    const send = vi.fn(async () => undefined);
    const services = {
      claim: async (month: string, mark: string) => {
        const key = `${month}:${mark}`;
        if (claimed.has(key)) return false;
        claimed.add(key);
        return true;
      },
      send,
    };
    expect(await runSpendAlert(ledger(12), providers, services)).toEqual({
      sent: true,
      marks: ["ledger-10", "perplexity-5"],
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(await runSpendAlert(ledger(12), providers, services)).toEqual({
      sent: false,
      marks: [],
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("says what was spent, by provider, and what to do about Perplexity", () => {
    const email = spendAlertEmail(ledger(12), providers, [
      "ledger-10",
      "perplexity-5",
    ]);
    expect(email.subject).toContain("$12.00 из $100");
    expect(email.text).toContain("Perplexity: $6.20");
    expect(email.text).toContain("пополните");
    expect(email.html).not.toContain("<script");
  });
});

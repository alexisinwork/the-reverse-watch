import { describe, expect, it, vi } from "vitest";

import {
  reserveValidationBudget,
  settleValidationBudget,
  validationCharges,
} from "./validation-budget.server";
import type { CatalogueClient } from "./watch-catalogue.server";

const attempt = "00000000-0000-4000-8000-000000000001";
function client(reply: unknown) {
  const fetchImpl = vi.fn(async () => Response.json(reply));
  const value: CatalogueClient = {
    config: { supabaseUrl: "https://db.example", serviceKey: "sb_secret_test" },
    fetchImpl,
  };
  return { value, fetchImpl };
}

describe("validation budget RPC client", () => {
  it("reports an already validated snapshot without reserving again", async () => {
    const db = client({ state: "valid" });
    await expect(
      reserveValidationBudget(db.value, "a".repeat(64), 1),
    ).resolves.toEqual({ state: "valid" });
  });
  it("reserves against a hash and a maximum of eight watches", async () => {
    const db = client({
      state: "reserved",
      attemptId: attempt,
      reservedUsd: 0.2,
    });
    expect(
      await reserveValidationBudget(db.value, "a".repeat(64), 8),
    ).toMatchObject({ state: "reserved", reservedUsd: 0.2 });
    const [, init] = db.fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body))).toEqual({
      p_cache_key: "a".repeat(64),
      p_watch_count: 8,
    });
    await expect(
      reserveValidationBudget(db.value, "a".repeat(64), 9),
    ).rejects.toThrow();
    expect(db.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("settles uncertain costs at the full per-watch reservation", async () => {
    const db = client(true);
    await expect(
      settleValidationBudget(db.value, attempt, [0.01, null]),
    ).resolves.toBe(true);
    const [, init] = db.fetchImpl.mock.calls[0] as unknown as [
      URL,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body))).toEqual({
      p_attempt_id: attempt,
      p_costs_usd: [0.01, 0.025],
    });
    await expect(
      settleValidationBudget(db.value, attempt, [0.026]),
    ).rejects.toThrow();
  });

  it("rounds known provider cost upward to ledger precision", () => {
    expect(validationCharges([0.004 + 0.0027, 0.006701])).toEqual([
      0.0067, 0.00671,
    ]);
    expect(validationCharges([0.025])).toEqual([0.025]);
  });
});

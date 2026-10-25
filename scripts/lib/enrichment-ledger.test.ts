import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createEnrichmentLedger } from "./enrichment-ledger";
const dirs: string[] = [];
const directory = () => {
  const dir = mkdtempSync(path.join(tmpdir(), "reserve-ledger-"));
  dirs.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    const resolved = path.resolve(dir);
    if (
      path.dirname(resolved) !== path.resolve(tmpdir()) ||
      !path.basename(resolved).startsWith("reserve-ledger-")
    )
      throw new Error("Unexpected test cleanup path");
    rmSync(resolved, { recursive: true, force: true });
  }
});
describe("paid request allowance recovery", () => {
  it("recovers the latest billing settlement even when the historical reserve is unchanged", () => {
    const dir = directory(),
      ledger = createEnrichmentLedger(dir, () => {
        throw new Error("locked");
      });
    const progress = ledger.load();
    progress.billing = {
      ownerReportedBaselineUsd: 5,
      baselineAt: "2026-10-25",
      perplexityReportedUsd: 0,
      perplexityUnreportedEstimateUsd: 0,
      perplexityPendingUsd: 0.1,
      perplexityCalls: 1,
      museCalls: 0,
    };
    ledger.save(progress);
    progress.billing.perplexityPendingUsd = 0;
    progress.billing.perplexityReportedUsd = 0.012609;
    ledger.save(progress);
    expect(
      createEnrichmentLedger(dir).load().billing?.perplexityReportedUsd,
    ).toBe(0.012609);
  });
  it("retains reservations when Windows refuses a snapshot rename", () => {
    const dir = directory(),
      ledger = createEnrichmentLedger(dir, () => {
        throw Object.assign(new Error("locked"), { code: "EPERM" });
      });
    ledger.save({ ...ledger.load(), reservedUsd: 18.7, calls: 98 });
    expect(createEnrichmentLedger(dir).load().reservedUsd).toBe(18.7);
  });
  it("uses the high-water reservation across old and partial snapshots", () => {
    const dir = directory(),
      ledger = createEnrichmentLedger(dir);
    const progress = { ...ledger.load(), reservedUsd: 20, calls: 100 };
    ledger.save(progress);
    writeFileSync(
      path.join(dir, "enrichment-progress.json"),
      JSON.stringify({ ...progress, reservedUsd: 18.5 }),
    );
    writeFileSync(path.join(dir, "enrichment-progress.json.tmp"), "{");
    expect(ledger.load().reservedUsd).toBe(20);
  });
  it("fails closed rather than resetting an unreadable allowance", () => {
    const dir = directory();
    writeFileSync(path.join(dir, "enrichment-progress.json"), "broken");
    expect(() => createEnrichmentLedger(dir).load()).toThrow(
      "refusing to reset",
    );
  });
});

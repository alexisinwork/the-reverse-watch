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

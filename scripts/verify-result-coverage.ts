// Real page/widget/API smoke using existing saved requests; no visitor PII.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";
import { z } from "zod";
import { catalogueClient } from "../app/domain/watch-catalogue.server";
import { validationBudgetStatus } from "../app/domain/validation-budget.server";
import { listPartnerSites } from "../app/domain/partner-sites.server";
import { uniqueWatchResults } from "../app/domain/watch-result-dedup";

const base = process.env.RESERVE_SMOKE_BASE ?? "https://thereserve.watch";
assert.ok(["https://thereserve.watch", "http://localhost:5173"].includes(base));
const client = catalogueClient();
assert.ok(client);
const partner = (await listPartnerSites(client)).find(
  (site) => site.name === "Portfolio local integration",
);
assert.ok(
  partner?.active && partner.allowedOrigins.includes("http://localhost:8080"),
);
const before = await validationBudgetStatus(client);
const card = z.object({
  brand: z.string(),
  model: z.string(),
  referenceCode: z.string().nullable(),
  details: z
    .object({ verificationStatus: z.literal("unverified").optional() })
    .passthrough(),
});
const cards = z.array(card).min(5).max(10);
const checks: { feature: string; count: number; uncertain: number }[] = [];
const archetype =
  "socialSignal=discreet_competence&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=first_good_watch&scoringVersion=2.0.0";
for (const [feature, path, init] of [
  ["find", "/api/v1/find?type=actor&q=Daniel%20Craig", {}],
  ["find repeat", "/api/v1/find?type=actor&q=Daniel%20Craig", {}],
  ["archetype", `/api/v1/archetype?${archetype}`, {}],
  [
    "alternatives",
    "/api/v1/alternatives?name=Tudor%20Black%20Bay%2058&ref=M79030N-0001&mode=exact&amount=2000&currency=USD&quartz=no",
    {},
  ],
  [
    "quiz",
    "/api/v1/quiz",
    {
      method: "POST",
      body: JSON.stringify({
        version: 4,
        budgetCurrency: "USD",
        priceRange: "1000_2000",
        wristCm: 17.5,
        wearingScenarios: ["everyday"],
        minimumWaterResistanceM: 30,
        movementTypes: ["automatic"],
        requiredComplications: [],
        allergyConstraint: "none",
      }),
    },
  ],
] as const) {
  const response: Response = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "X-Reserve-Key": partner.publicKey,
      Origin: "http://localhost:8080",
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(110_000),
  });
  assert.equal(response.status, 200, `${feature} HTTP status`);
  const body = z
    .object({
      result: z
        .object({
          status: z.literal("found"),
          watches: cards,
          alsoWorth: z.array(card).optional(),
        })
        .optional(),
      watches: cards.optional(),
    })
    .parse(await response.json());
  const watches = body.result
    ? [...body.result.watches, ...(body.result.alsoWorth ?? [])]
    : body.watches!;
  assert.ok(watches.length >= 5 && watches.length <= 10);
  assert.equal(uniqueWatchResults(watches).length, watches.length);
  const uncertain = watches.filter(
    (watch) => watch.details.verificationStatus === "unverified",
  ).length;
  if (feature.startsWith("find")) {
    assert.equal(watches.length, 10);
    assert.equal(uncertain, 9);
  }
  checks.push({ feature, count: watches.length, uncertain });
  console.log(JSON.stringify({ feature, count: watches.length, uncertain }));
}
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ permissions: ["local-network-access"] });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`${base}/watches/find?type=actor&q=Daniel%20Craig`, {
      waitUntil: "domcontentloaded",
    });
    await expect(page.locator("article.watch-card")).toHaveCount(10, {
      timeout: 60_000,
    });
    await expect(
      page.getByText("Association not fully verified", { exact: true }),
    ).toHaveCount(9);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
  }
  // The blank host is intercepted; the script, iframe and results are real.
  await page.route("http://localhost:8080/reserve-coverage-check", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><meta charset="utf-8"></head><body><div data-reserve="find"></div><script src="${base}/embed.js" data-key="${partner.publicKey}"></script></body></html>`,
    }),
  );
  await page.goto("http://localhost:8080/reserve-coverage-check");
  const frame = page.frameLocator("iframe");
  await frame.getByLabel("What are you searching for?").selectOption("actor");
  await frame
    .getByLabel("Name of the movie, series, actor, character or celebrity")
    .fill("Daniel Craig");
  await frame.getByRole("button", { name: "Search", exact: true }).click();
  await expect(frame.locator("article.watch-card")).toHaveCount(10, {
    timeout: 60_000,
  });
  await expect(frame.getByRole("link")).toHaveCount(1);
  await expect(frame.getByRole("link")).toHaveText("Powered by The Reserve");
} finally {
  await browser.close();
}
const after = await validationBudgetStatus(client);
assert.equal(
  after.spentUsd,
  before.spentUsd,
  "Saved coverage should add no provider charge",
);
assert.equal(
  after.attempts,
  before.attempts,
  "Saved coverage should add no paid attempt",
);
const report = {
  at: new Date().toISOString(),
  base,
  checks,
  browser: { desktop: true, mobile: true, widgetOnlyPoweredLink: true },
  budgetBefore: before,
  budgetAfter: after,
  addedCharge: after.spentUsd - before.spentUsd,
  addedAttempts: after.attempts - before.attempts,
};
await writeFile(
  `docs/reports/result-coverage-${base.startsWith("https") ? "production" : "local"}.json`,
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));

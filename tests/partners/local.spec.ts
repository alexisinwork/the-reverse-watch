import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";

type Site = {
  id: string;
  publicKey: string;
  usage: unknown[];
  active: boolean;
};
async function rpc<T>(name: string, body: unknown): Promise<T> {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const response = await fetch(
    `${process.env.SUPABASE_URL}/rest/v1/rpc/${name}`,
    {
      method: "POST",
      headers: {
        apikey: key,
        ...(key.startsWith("eyJ") ? { authorization: `Bearer ${key}` } : {}),
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (!response.ok)
    throw new Error(`Partner test RPC ${name}: HTTP ${response.status}`);
  return (await response.json()) as T;
}
const listPartnerSites = async (): Promise<Site[]> =>
  rpc("partner_sites_list_v1", {});
const savePartnerSite = async (input: object): Promise<Site> =>
  rpc("partner_site_save_v1", {
    p_site: {
      publicKey: `pk_live_${randomBytes(12).toString("hex")}`,
      ...input,
    },
  });
const recordPartnerUse = async (
  site: Site,
  feature: string,
): Promise<{ allowed: boolean }> =>
  rpc("partner_site_use_v1", { p_site: site.id, p_feature: feature });

const features = [
  ["quiz", "Find your watch"],
  ["archetype", "Your watch archetype"],
  ["find", "Film, TV & people"],
  ["alternatives", "Cheaper alternatives"],
  ["stories", "Watch stories"],
] as const;
const config = parseEnv(readFileSync("../personal-website/.env.local", "utf8"));
const publicKey = config.VITE_RESERVE_PUBLIC_KEY!;
const service = "http://localhost:5173";

async function openTool(page: Page, feature: (typeof features)[number][0]) {
  await page
    .getByRole("button", {
      name: features.find(([id]) => id === feature)![1],
      exact: true,
    })
    .click();
  const frame = page.frameLocator(`[data-reserve="${feature}"] iframe`);
  await expect(
    frame.getByText("Powered by The Reserve", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: "Watch advisor ready." }),
  ).toBeVisible();
  return frame;
}

test("five real tools, preserved answers, mobile and admin", async ({
  page,
}) => {
  await page.goto("/watch-advisor-demo");
  const quiz = await openTool(page, "quiz");
  await quiz.getByLabel("USD 1k–2k", { exact: true }).check();
  await quiz.getByRole("button", { name: "Next", exact: true }).click();
  await quiz.getByRole("button", { name: "17 cm", exact: true }).click();
  const archetype = await openTool(page, "archetype");
  for (const group of await archetype.locator("fieldset").all())
    await group.getByRole("radio").first().check();
  await archetype
    .getByRole("button", { name: "Reveal editorial archetype" })
    .click();
  await expect(
    archetype.getByRole("heading", { name: "Choose your next direction" }),
  ).toBeVisible();
  const find = await openTool(page, "find");
  await find.getByLabel("What are you searching for?").selectOption("movie");
  await find
    .getByLabel("Name of the movie, series, actor, character or celebrity")
    .fill("Heat");
  await find.getByRole("button", { name: "Search", exact: true }).click();
  await expect(
    find.getByRole("heading", { name: "Watches in “Heat”" }),
  ).toBeVisible({ timeout: 60_000 });
  await openTool(page, "alternatives");
  await openTool(page, "stories");
  await openTool(page, "quiz");
  await expect(quiz.getByLabel("Wrist circumference")).toHaveValue("17");
  await expect(page.locator("iframe")).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect(quiz.locator('input[type="email"]')).toHaveCount(0);
  await page.screenshot({
    path: "test-results/partner-mobile.png",
    fullPage: true,
  });
  await page.goto(`${service}/admin/sites`);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Portfolio local integration",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Vite configuration for Portfolio local integration"),
  ).toHaveValue(
    `VITE_RESERVE_ORIGIN=${service}\nVITE_RESERVE_PUBLIC_KEY=${publicKey}`,
  );
});

test("complete six-screen diagnostic", async ({ page }) => {
  await page.goto("/watch-advisor-demo");
  const frame = await openTool(page, "quiz");
  await frame.getByLabel("USD 1k–2k", { exact: true }).check();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByRole("button", { name: "17 cm", exact: true }).click();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByLabel("Everyday", { exact: true }).check();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByLabel("Automatic", { exact: true }).check();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByRole("button", { name: "Next", exact: true }).click();
  await frame.getByRole("button", { name: /find|show|shortlist/i }).click();
  await expect(
    frame.getByRole("heading", { name: /Watches that fit every answer/ }),
  ).toBeVisible({ timeout: 90_000 });
});

test("submit cheaper alternatives against the real catalogue", async ({
  page,
}) => {
  await page.goto("/watch-advisor-demo");
  const frame = await openTool(page, "alternatives");
  await frame.getByLabel("Watch", { exact: true }).fill("Tudor Black Bay 58");
  await frame.getByLabel("Price", { exact: true }).fill("2000");
  await frame.getByLabel("No, mechanical only", { exact: true }).check();
  await frame
    .getByRole("button", { name: "Find alternatives", exact: true })
    .click();
  await expect(
    frame.getByRole("heading", {
      name: "Alternatives to the Tudor Black Bay 58",
    }),
  ).toBeVisible({ timeout: 120_000 });
  await expect(
    frame.getByText("Manufacturer reference not confirmed").first(),
  ).toBeVisible();
});

test("script failure displays a working retry", async ({ page }) => {
  await page.route(`${service}/embed.js`, (route) => route.abort());
  await page.goto("/watch-advisor-demo");
  await expect(page.getByRole("status")).toContainText("could not connect");
  await page.unroute(`${service}/embed.js`);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("Watch advisor ready.");
});

test("registered framing, disabled key, wrong origin and quota", async ({
  request,
  browser,
}) => {
  const response = await request.get(`${service}/embed/${publicKey}/archetype`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors http://localhost:8080 http://127.0.0.1:8080",
  );
  expect(response.headers()["x-frame-options"]).toBeUndefined();
  const disabled = await savePartnerSite({
    name: "Local integration disabled check",
    active: false,
    allowedOrigins: ["http://localhost:8080"],
    monthlyQuota: 1,
    theme: {},
    notes: "Automated integration test; intentionally disabled.",
  });
  expect(
    (
      await request.get(`${service}/embed/${disabled.publicKey}/archetype`)
    ).status(),
  ).toBe(404);
  const quota = await savePartnerSite({
    name: "Local integration quota check",
    active: true,
    allowedOrigins: ["http://localhost:8080"],
    monthlyQuota: 1,
    theme: {},
    notes: "Automated integration test; switched off on completion.",
  });
  try {
    expect((await recordPartnerUse(quota, "quiz")).allowed).toBe(true);
    expect((await recordPartnerUse(quota, "quiz")).allowed).toBe(false);
    const limit = await request.get(
      `${service}/embed/${quota.publicKey}/archetype?socialSignal=discreet_competence&aestheticDna=structural_tool&deploymentEnvironment=field_water_abuse&priceComfort=first_good_watch&scoringVersion=2.0.0`,
    );
    expect(await limit.text()).toContain("used all of its searches");
  } finally {
    await savePartnerSite({ ...quota, active: false });
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  // Use an actual unregistered local server. Browser interception assigns a
  // different network address space and can trigger Local Network Access first.
  const wrongOrigin = createServer((_request, response) => {
    response.setHeader("Content-Type", "text/html");
    response.end(
      `<iframe src="${service}/embed/${publicKey}/archetype"></iframe>`,
    );
  });
  await new Promise<void>((resolve) =>
    wrongOrigin.listen(0, "localhost", resolve),
  );
  const address = wrongOrigin.address();
  if (!address || typeof address === "string")
    throw new Error("No test server port");
  const errors: string[] = [];
  page.on("console", (message) => errors.push(message.text()));
  try {
    await page.goto(`http://localhost:${address.port}/`);
    await expect
      .poll(() => errors.some((message) => /frame-ancestors/.test(message)))
      .toBe(true);
  } finally {
    await context.close();
    wrongOrigin.closeAllConnections();
    wrongOrigin.close();
  }
  const sites = await listPartnerSites();
  expect(
    sites.find((site) => site.publicKey === publicKey)?.usage.length,
  ).toBeGreaterThan(0);
});

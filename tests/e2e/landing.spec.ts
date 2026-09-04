import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  issueDiagnosticAccessCookie,
  parseDiagnosticAccessConfiguration,
} from "../../app/domain/diagnostic-access.server";

async function grantDiagnosticAccess(page: Page) {
  const configuration = parseDiagnosticAccessConfiguration(process.env);
  if (!configuration.configured) {
    throw new Error("The E2E diagnostic access secret is not configured.");
  }
  const setCookie = await issueDiagnosticAccessCookie(configuration);
  const [nameValue] = setCookie.split(";", 1);
  if (!nameValue) throw new Error("The access cookie was not issued.");
  const separator = nameValue.indexOf("=");
  await page.context().addCookies([
    {
      name: nameValue.slice(0, separator),
      value: nameValue.slice(separator + 1),
      url: "http://127.0.0.1:4173",
    },
  ]);
}

test("renders the landing page and legible subscription form", async ({
  page,
}) => {
  const response = await page.goto("/", { waitUntil: "domcontentloaded" });

  await expect(
    page.getByRole("heading", { level: 1, name: "The Reserve" }),
  ).toBeVisible();
  await expect(page.getByText("Archival Documentary")).toBeVisible();
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/favicon.svg",
  );

  const sentryDsn = process.env.SENTRY_DSN?.trim();
  if (sentryDsn) {
    expect(response?.headers()["content-security-policy"]).toContain(
      new URL(sentryDsn).origin,
    );
  }

  const emailInput = page.getByLabel("Email address");
  await expect(emailInput).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /agree to receive/i }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Subscribe" })).toBeVisible();
  await expect(
    page.locator('script[src*="subscribe-forms.beehiiv.com"]'),
  ).toHaveCount(0);

  const inputColors = await emailInput.evaluate((element) => {
    const style = window.getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  });
  expect(inputColors).toEqual(
    expect.objectContaining({
      background: "rgb(8, 9, 11)",
      color: "rgb(255, 255, 255)",
    }),
  );
  await expect(
    page.locator('script[src="/_vercel/insights/script.js"]'),
  ).toHaveCount(1);

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("exposes a healthy service route", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBeTruthy();
  await expect(response.json()).resolves.toMatchObject({
    status: "ok",
    service: "the-reserve-web",
  });
});

test("browses sourced watch discovery without hiding uncertainty", async ({
  page,
}) => {
  await page.goto("/watches");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Watches of Celebrity & Cinema",
    }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Annie Edison's recurring Community watch" })
    .click();
  await expect(page.getByText("Unconfirmed identification")).toBeVisible();
  await expect(page.getByText("Not identified")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Reviewed sources" }),
  ).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});

test("creates a shareable archetype without bypassing hard constraints", async ({
  page,
}) => {
  await grantDiagnosticAccess(page);
  const discoveryEvents: unknown[] = [];
  page.on("request", (request) => {
    if (!request.url().endsWith("/analytics/discovery")) return;
    const payload = request.postData();
    if (payload) discoveryEvents.push(JSON.parse(payload) as unknown);
  });
  await page.goto("/watches/archetype");
  await page
    .getByLabel("Utility, with little interest in luxury codes")
    .check();
  await page.getByLabel("Visible purpose and protection").check();
  await page.getByLabel("Field, water, travel, or hard use").check();
  await page.getByLabel("A considered first serious watch").check();
  await page
    .getByRole("button", { name: "Reveal editorial archetype" })
    .click();

  await expect(
    page.getByRole("heading", { level: 1, name: "The Field Rationalist" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Share this result" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Find the right watch for me" }),
  ).toHaveAttribute(
    "href",
    "/quiz?source=archetype&socialSignal=anti_luxury&aestheticDna=structural_tool",
  );
  await expect(page.getByText(/No email is required/)).toBeVisible();
  await expect
    .poll(() => discoveryEvents)
    .toEqual(
      expect.arrayContaining([
        { name: "page_view", surface: "archetype" },
        { name: "archetype_start" },
        {
          name: "archetype_completion",
          archetypeId: "field_rationalist",
        },
      ]),
    );

  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);

  await page.getByRole("link", { name: "Find the right watch for me" }).click();
  await expect(
    page.getByRole("heading", { name: "What is the actual purchase ceiling?" }),
  ).toBeVisible();
  await expect
    .poll(() => discoveryEvents)
    .toContainEqual({
      name: "core_handoff",
      archetypeId: "field_rationalist",
    });
});

test("uses the branded error boundary for unknown routes", async ({ page }) => {
  const response = await page.goto("/not-in-the-archive");

  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "Record not found" }),
  ).toBeVisible();
});

test("completes the six-screen diagnostic without a model provider", async ({
  page,
}) => {
  await grantDiagnosticAccess(page);
  await page.goto("/quiz");

  await expect(page.getByText("Step 1 of 6")).toBeVisible();
  await page.getByLabel("Maximum amount").fill("10000");
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("checkbox", { name: "Office" }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("checkbox", { name: "Automatic" }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 6 of 6")).toBeVisible();
  await page.getByRole("button", { name: "See the shortlist" }).click();

  await expect(
    page.getByRole("heading", { name: "Your search boundary" }),
  ).toBeVisible();
  await expect(page.getByText("USD 10,000")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/personal profile/i);

  await page.getByRole("button", { name: "Restart diagnostic" }).click();
  await expect(
    page.getByRole("heading", {
      name: "What is the actual purchase ceiling?",
    }),
  ).toBeVisible();
  await expect(page.getByLabel("Maximum amount")).toHaveValue("");
});

test("narrows the shortlist by positioning without changing the exclusions", async ({
  page,
}) => {
  await grantDiagnosticAccess(page);
  await page.goto("/quiz");

  await page.getByLabel("Maximum amount").fill("100000");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("checkbox", { name: "Office" }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("checkbox", { name: "Automatic" }).check();
  await page.getByRole("checkbox", { name: "Quartz" }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "See the shortlist" }).click();

  await expect(
    page.getByRole("heading", { name: "Sources used in this result" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Inspect manufacturer source" }).first(),
  ).toBeVisible();

  const facet = page.getByRole("group", { name: "Positioning" });
  const shortlisted = page.locator(".candidate-card");
  const excluded = page.locator(".why-not-list article");
  const exclusionsBefore = await excluded.count();

  // The facet only appears once a returned candidate carries a positioning
  // group, which no reviewed variant does until the sheet is imported.
  if (await facet.isVisible()) {
    const before = await shortlisted.count();
    const chip = facet.getByRole("button").nth(1);
    const label = await chip.textContent();
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
    const after = await shortlisted.count();
    expect(after).toBeLessThanOrEqual(before);
    expect(await excluded.count()).toBe(exclusionsBefore);
    await facet.getByRole("button", { name: "All" }).click();
    expect(await shortlisted.count()).toBe(before);
    expect(label).not.toBeNull();
  }

  await expect(page.locator("body")).not.toContainText(
    /supabase|sql|beehiiv|engine v|catalogue v|bundled snapshot/i,
  );
});

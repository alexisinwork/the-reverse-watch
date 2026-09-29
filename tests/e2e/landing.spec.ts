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

test("completes the six-screen diagnostic and streams the shortlist", async ({
  page,
}) => {
  await grantDiagnosticAccess(page);
  await page.goto("/quiz");

  await expect(page.getByText("Step 1 of 6")).toBeVisible();
  await page.getByRole("radio", { name: "USD 9k–10k" }).check();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByLabel("Wrist circumference").fill("17.5");
  await expect(page.getByText(/cases of 38–42 mm/)).toBeVisible();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("checkbox", { name: "Office" }).check();
  await page.getByRole("button", { name: "Next" }).click();

  await page.getByRole("checkbox", { name: "Automatic" }).check();
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Next" }).click();

  await expect(page.getByText("Step 6 of 6")).toBeVisible();
  await page.getByRole("button", { name: "See the shortlist" }).click();

  // The answers render at once; the AI shortlist streams in afterwards.
  await expect(
    page.getByRole("heading", { name: "Your search boundary" }),
  ).toBeVisible();
  await expect(page.getByText("USD 9k–10k")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Watches that fit every answer" }),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/personal profile/i);

  await page.getByRole("button", { name: "Restart diagnostic" }).click();
  await expect(
    page.getByRole("heading", {
      name: "What price range are you shopping in?",
    }),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "USD 9k–10k" })).not.toBeChecked();
});

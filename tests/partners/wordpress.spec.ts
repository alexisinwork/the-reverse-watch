import { expect, test } from "@playwright/test";

/** Optional real PHP/WordPress check; start Playground before setting this URL. */
test("WordPress shortcode hosts five isolated tools", async ({ page }) => {
  test.skip(
    !process.env.WORDPRESS_TEST_URL,
    "Set WORDPRESS_TEST_URL to the published local shortcode page.",
  );
  await page.goto(process.env.WORDPRESS_TEST_URL!);
  const advisor = page.locator('[data-reserve="all"]');
  const features = ["quiz", "archetype", "find", "alternatives", "stories"];
  const buttons = advisor.locator(".reserve-advisor__tools button");
  await expect(buttons).toHaveCount(5);
  for (let index = 0; index < features.length; index++) {
    await buttons.nth(index).click();
    await expect(advisor.getByRole("status")).toHaveText(
      "Watch advisor ready.",
    );
    await expect(
      advisor
        .frameLocator(`[data-reserve="${features[index]}"] iframe`)
        .getByText("Powered by The Reserve", { exact: true }),
    ).toBeVisible();
  }
  await buttons.nth(1).click();
  const archetype = advisor.frameLocator('[data-reserve="archetype"] iframe');
  for (const group of await archetype.locator("fieldset").all())
    await group.getByRole("radio").first().check();
  await archetype
    .getByRole("button", { name: "Reveal editorial archetype" })
    .click();
  await expect(
    archetype.getByRole("heading", {
      name: "The Field Rationalist",
      exact: true,
    }),
  ).toBeVisible();
  await expect(archetype.getByRole("link")).toHaveCount(1);
  await expect(archetype.getByRole("link")).toHaveText(
    "Powered by The Reserve",
  );
  await expect(archetype.locator("article.watch-card")).toHaveCount(10, {
    timeout: 90_000,
  });
  await buttons.nth(2).click();
  const find = advisor.frameLocator('[data-reserve="find"] iframe');
  await find.getByLabel("What are you searching for?").selectOption("actor");
  await find
    .getByLabel("Name of the movie, series, actor, character or celebrity")
    .fill("Daniel Craig");
  await find.getByRole("button", { name: "Search", exact: true }).click();
  await expect(find.locator("article.watch-card")).toHaveCount(10, {
    timeout: 60_000,
  });
  await expect(find.getByRole("link")).toHaveCount(1);
  await buttons.nth(0).click();
  const quiz = advisor.frameLocator('[data-reserve="quiz"] iframe');
  await quiz.getByLabel("USD 1k–2k", { exact: true }).check();
  await buttons.nth(1).click();
  await expect(
    archetype.getByRole("heading", {
      name: "The Field Rationalist",
      exact: true,
    }),
  ).toBeVisible();
  await buttons.nth(0).click();
  await expect(quiz.getByLabel("USD 1k–2k", { exact: true })).toBeChecked();
  await expect(advisor.locator("iframe")).toHaveCount(5);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await page.screenshot({
    path: "test-results/wordpress-advisor-mobile.png",
    fullPage: true,
  });
});

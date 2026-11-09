import { expect, test } from "@playwright/test";

test("the app opens with no errors and shows the roll library", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Banjo Practice" })).toBeVisible();
  await expect(page.locator(".roll")).toHaveCount(8);
  await expect(page.locator(".check.ok")).toHaveCount(8);
  expect(errors).toEqual([]);
});

test("the toolbar stays on screen", async ({ page }) => {
  await page.goto("/");
  const box = await page.locator(".toolbar").boundingBox();
  expect(box?.y).toBe(0);
});

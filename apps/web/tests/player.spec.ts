import { expect, test } from "@playwright/test";

test("player can see the case interface", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Rain Tower Murder" })).toBeVisible();
  await expect(page.getByLabel("Action input")).toBeVisible();
  await expect(page.getByText("Known Clues")).toBeVisible();
  await expect(page.getByText("Developer Trace")).toBeVisible();
  await expect(page.getByRole("region", { name: "Current Location" }).getByText("foyer")).toBeVisible();

  await page.getByLabel("Action input").fill("inspect broken_watch");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("region", { name: "Known Clues" }).getByText("broken_watch")).toBeVisible();
  await expect(page.getByRole("region", { name: "Developer Trace" }).getByText(/accepted=1/)).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("player can see the case interface", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "雨塔谋杀案" })).toBeVisible();
  await expect(page.getByLabel("行动指令")).toBeVisible();
  await expect(page.getByRole("region", { name: "已知线索" })).toBeVisible();
  await expect(page.getByRole("region", { name: "开发追踪" })).toBeVisible();
  await expect(page.getByRole("region", { name: "当前位置" }).getByText("门厅")).toBeVisible();

  await page.getByLabel("行动指令").fill("inspect broken_watch");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("region", { name: "已知线索" }).getByText("破损怀表")).toBeVisible();
  await expect(page.getByRole("region", { name: "开发追踪" }).getByText(/accepted=1/)).toBeVisible();
});

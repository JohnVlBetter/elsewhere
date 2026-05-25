import { expect, test } from "@playwright/test";

test("player can see the case interface", async ({ page }) => {
  await page.route("**/api/turn", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        outputText: "怀表外壳裂开，指针停在八点四十七分。",
        messages: [
          {
            type: "clue",
            clueId: "broken_watch",
            label: "破损怀表",
            text: "银质怀表停在 8:47，早于众人声称听见塔钟自鸣的九点。"
          }
        ],
        state: {
          currentLocationId: "foyer",
          turn: 1,
          inventory: [],
          knownClues: ["broken_watch"],
          flags: {},
          npcAttitudes: {},
          questStages: { solve_murder: "investigate" }
        },
        acceptedPatches: [{ type: "discover_clue", clueId: "broken_watch", reason: "Inspected silver_watch." }],
        rejectedPatches: [],
        trace: {
          precheck: { ok: true },
          contextIds: ["location:foyer"],
          agentRole: "narrator",
          modelName: "fake"
        }
      })
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "雨塔谋杀案" })).toBeVisible();
  await expect(page.getByLabel("行动指令")).toBeVisible();
  await expect(page.getByRole("region", { name: "已知线索" })).toBeVisible();
  await expect(page.getByRole("region", { name: "运行状态" })).toBeVisible();
  await expect(page.getByRole("region", { name: "当前位置" }).getByText("门厅")).toBeVisible();
  await expect(page.getByText(/你是进入《雨塔谋杀案》的调查者/)).toBeVisible();

  await page.getByLabel("行动指令").fill("检查银怀表");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.getByRole("region", { name: "已知线索" }).getByText("破损怀表")).toBeVisible();
  await expect(page.getByText("银质怀表停在 8:47，早于众人声称听见塔钟自鸣的九点。")).toBeVisible();
  await expect(page.getByRole("region", { name: "运行状态" }).getByText(/采纳=1/)).toBeVisible();
});

import { expect, test } from "@playwright/test";

test("shows story overview before starting a session", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "故事库" })).toBeVisible();
  await expect(page.getByRole("region", { name: "精选故事" })).toBeVisible();
  await expect(page.getByTestId("story-card").first()).toBeVisible();
  await expect(page.getByRole("link", { name: /雨塔谜案/ })).toBeVisible();
});

test("starts selected story and keeps runtime details hidden", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /雨塔谜案/ }).click();

  await expect(page).toHaveURL(/\/play\/rain-tower/);
  await expect(page.getByPlaceholder("写下你的行动")).toBeVisible();
  await expect(page.getByText("正在调用模型")).not.toBeVisible();
  await expect(page.getByText("Runtime")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "指认管家" })).not.toBeVisible();
});

test("uses immersive reader layout without broken visual slots", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("story-cover-slot").first()).toBeVisible();

  await page.locator('a[href="/play/rain-tower"]').click();
  await expect(page.getByTestId("game-shell")).toBeVisible();
  await expect(page.getByTestId("timeline")).toBeVisible();
  await expect(page.getByTestId("action-composer")).toBeVisible();
  await expect(page.getByTestId("state-sidebar")).toBeVisible();
});

test("renders different event classes for action dialogue and evidence", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "session-1",
        packId: "rain-tower",
        manifest: {
          id: "rain-tower",
          name: "雨塔谜案",
          version: "0.2.0",
          runtimeVersion: "0.2.0",
          entryLocationId: "foyer",
          profileId: "detective"
        },
        profile: {
          id: "detective",
          labels: { location: "地点", facts: "线索", inventory: "物品", objectives: "进展" },
          theme: { tone: "cool", accentColor: "#5f8dd3" },
          assets: { fallbackPattern: "rain" },
          quickActions: [],
          actions: {}
        },
        entities: {
          locations: [{ id: "foyer", name: "门厅" }],
          characters: [{ id: "butler", name: "管家", assets: { avatar: "generated/avatars/butler.webp" } }],
          items: [],
          facts: [{ id: "butler_kitchen", name: "厨房证词" }],
          objectives: [{ id: "solve_murder", name: "查明真相", stages: ["investigate"] }]
        },
        intro: "雨声压低了所有人的声音。",
        state: {
          currentLocationId: "foyer",
          turn: 0,
          inventory: [],
          knownFacts: [],
          resources: {},
          relationships: {},
          flags: {},
          objectiveStages: { solve_murder: "investigate" }
        }
      })
    });
  });

  await page.route("**/api/turn/stream", async (route) => {
    await route.fulfill({
      contentType: "text/event-stream",
      body: `event: result\ndata: ${JSON.stringify({
        outputText: "管家低声回答。",
        state: {
          currentLocationId: "foyer",
          turn: 1,
          inventory: [],
          knownFacts: ["butler_kitchen"],
          resources: {},
          relationships: {},
          flags: {},
          objectiveStages: { solve_murder: "investigate" }
        },
        timelineEvents: [
          { id: "evt_1", kind: "player_action", actorId: "player", text: "询问管家", timestamp: "2026-05-29T12:00:00.000Z", visibleToPlayer: true },
          { id: "evt_2", kind: "dialogue", speakerId: "butler", speakerName: "管家", text: "我一直在厨房。", timestamp: "2026-05-29T12:00:00.000Z", visibleToPlayer: true },
          { id: "evt_3", kind: "evidence", refId: "butler_kitchen", text: "管家声称自己整晚在厨房。", timestamp: "2026-05-29T12:00:00.000Z", visibleToPlayer: true }
        ],
        acceptedPatches: [],
        rejectedPatches: [],
        trace: { precheck: { ok: true } }
      })}\n\n`
    });
  });

  await page.goto("/play/rain-tower");
  await page.getByPlaceholder("写下你的行动").fill("询问管家");
  await page.getByRole("button", { name: "发送" }).click();

  await expect(page.locator("[data-event-kind='player_action']")).toBeVisible();
  await expect(page.locator("[data-event-kind='dialogue']")).toBeVisible();
  await expect(page.locator("[data-event-kind='evidence']")).toBeVisible();
});

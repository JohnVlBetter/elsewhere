import { expect, test } from "@playwright/test";

test("player can use a profile-driven world interface", async ({ page }) => {
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: "session-1",
        packId: "campus-lunch",
        manifest: {
          id: "campus-lunch",
          name: "Campus Lunch",
          version: "0.2.0",
          runtimeVersion: "0.2.0",
          entryLocationId: "classroom",
          profileId: "romance"
        },
        profile: {
          id: "romance",
          labels: {
            location: "Place",
            characters: "People",
            facts: "Memories",
            inventory: "Bag",
            resources: "Stats",
            relationships: "Bonds",
            objectives: "Objectives"
          },
          quickActions: [{ label: "Look around", command: "look" }],
          actions: {}
        },
        entities: {
          locations: [{ id: "classroom", name: "Classroom" }],
          characters: [{ id: "lin", name: "Lin" }],
          items: [{ id: "paper_note", name: "Paper note" }],
          facts: [{ id: "missed_note", name: "Missed note" }],
          objectives: [{ id: "repair_lunch", name: "Repair lunch", stages: ["awkward", "warm"] }]
        },
        intro: "Campus intro",
        state: {
          currentLocationId: "classroom",
          turn: 0,
          inventory: [],
          knownFacts: [],
          resources: { courage: 1 },
          relationships: { lin: 0 },
          flags: {},
          objectiveStages: { repair_lunch: "awkward" }
        }
      })
    });
  });

  await page.route("**/api/turn/stream", async (route) => {
    await route.fulfill({
      contentType: "text/event-stream",
      body: `event: status\ndata: ${JSON.stringify({ message: "Calling model..." })}\n\nevent: result\ndata: ${JSON.stringify({
        outputText: "The note explains the missed lunch.",
        messages: [
          {
            type: "fact",
            factId: "missed_note",
            label: "Missed note",
            text: "The note explains the missed lunch."
          }
        ],
        state: {
          currentLocationId: "classroom",
          turn: 1,
          inventory: ["paper_note"],
          knownFacts: ["missed_note"],
          resources: { courage: 2 },
          relationships: { lin: 1 },
          flags: {},
          objectiveStages: { repair_lunch: "warm" }
        },
        acceptedPatches: [{ type: "reveal_fact", factId: "missed_note", reason: "Inspected paper_note." }],
        rejectedPatches: [],
        trace: {
          precheck: { ok: true },
          contextIds: ["location:classroom"],
          agentRole: "narrator",
          modelName: "fake"
        }
      })}\n\n`
    });
  });

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Campus Lunch" })).toBeVisible();
  await expect(page.getByLabel("Action command")).toBeVisible();
  await expect(page.getByRole("region", { name: "Memories" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Bag" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Place" }).getByText("Classroom")).toBeVisible();
  await expect(page.getByText("Campus intro")).toBeVisible();

  await page.getByLabel("Action command").fill("inspect paper_note");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByRole("region", { name: "Memories" }).getByText("Missed note")).toBeVisible();
  await expect(page.getByRole("region", { name: "Bag" }).getByText("Paper note")).toBeVisible();
  await expect(page.getByText("The note explains the missed lunch.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Runtime" }).getByText(/accepted=1/)).toBeVisible();
});

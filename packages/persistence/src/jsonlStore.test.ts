import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createJsonlSessionStore } from "./jsonlStore";

describe("jsonl session store", () => {
  it("creates a session and appends timeline events as jsonl", async () => {
    const root = await mkdtemp(join(tmpdir(), "sessions-"));
    try {
      const store = createJsonlSessionStore(root);
      const session = await store.createSession({
        packId: "rain-tower",
        state: {
          currentLocationId: "foyer",
          turn: 0,
          knownFacts: [],
          inventory: [],
          flags: {},
          relationships: {},
          resources: {},
          objectiveStages: {}
        }
      });

      await store.appendTimelineEvents(session.id, [
        {
          id: "evt_1",
          kind: "player_action",
          text: "ask everyone",
          timestamp: "2026-05-28T12:00:00.000Z",
          actorId: "player",
          visibleToPlayer: true
        }
      ]);

      const events = await store.listTimelineEvents(session.id);
      expect(events).toHaveLength(1);
      expect(events[0]?.text).toBe("ask everyone");

      const raw = await readFile(join(root, session.id, "timeline.jsonl"), "utf8");
      expect(raw.trim()).toContain('"kind":"player_action"');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { createSqliteStore } from "./sqliteStore";

describe("sqlite store", () => {
  it("creates sessions and appends events", () => {
    const store = createSqliteStore(":memory:");
    const session = store.createSession({
      packId: "rain-tower",
      initialState: {
        currentLocationId: "foyer",
        turn: 0,
        inventory: [],
        knownClues: [],
        flags: {},
        npcAttitudes: {},
        questStages: { solve_murder: "investigate" }
      }
    });

    store.appendEvent({
      sessionId: session.id,
      turnNo: 1,
      actor: "player",
      inputText: "look",
      action: { type: "look", rawText: "look" },
      outputText: "You stand in the foyer.",
      patches: [],
      trace: { contextIds: ["location:foyer"] }
    });

    expect(store.getSession(session.id)?.state.currentLocationId).toBe("foyer");
    expect(store.listEvents(session.id)).toHaveLength(1);
  });

  it("writes to a workspace file database without deleting journal files", () => {
    const store = createSqliteStore(join(".tmp", `sqlite-store-workspace-${randomUUID()}.db`));
    const session = store.createSession({
      packId: "rain-tower",
      initialState: {
        currentLocationId: "foyer",
        turn: 0,
        inventory: [],
        knownClues: [],
        flags: {},
        npcAttitudes: {},
        questStages: { solve_murder: "investigate" }
      }
    });

    expect(store.getSession(session.id)?.packId).toBe("rain-tower");
  });

  it("creates parent directories for file databases", () => {
    const root = mkdtempSync(join(tmpdir(), "aigame-store-"));
    const dbPath = join(root, "nested", "store.db");
    const store = createSqliteStore(dbPath);
    const session = store.createSession({
      packId: "rain-tower",
      initialState: {
        currentLocationId: "foyer",
        turn: 0,
        inventory: [],
        knownClues: [],
        flags: {},
        npcAttitudes: {},
        questStages: { solve_murder: "investigate" }
      }
    });

    expect(store.getSession(session.id)?.packId).toBe("rain-tower");
    expect(existsSync(dbPath)).toBe(true);
  });
});

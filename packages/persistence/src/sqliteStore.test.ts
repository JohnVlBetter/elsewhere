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
});

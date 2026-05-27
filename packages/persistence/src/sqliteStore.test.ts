import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import type { SessionState } from "@aigame/shared";
import { createSqliteStore } from "./sqliteStore";

const initialState: SessionState = {
  currentLocationId: "foyer",
  turn: 0,
  inventory: [],
  knownFacts: [],
  resources: {},
  relationships: {},
  flags: {},
  objectiveStages: { solve_murder: "investigate" }
};

describe("sqlite store", () => {
  it("creates sessions and appends events", () => {
    const store = createSqliteStore(":memory:");
    const session = store.createSession({
      packId: "rain-tower",
      initialState
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

  it("records a completed turn with state and event in one operation", () => {
    const store = createSqliteStore(":memory:");
    const session = store.createSession({
      packId: "rain-tower",
      initialState
    });

    const nextState: SessionState = { ...initialState, turn: 1, knownFacts: ["broken_watch"] };
    const event = store.recordTurn({
      sessionId: session.id,
      state: nextState,
      turnNo: 1,
      actor: "player",
      inputText: "inspect silver_watch",
      action: { type: "inspect", targetId: "silver_watch", rawText: "inspect silver_watch" },
      outputText: "Known fact: broken_watch",
      patches: [{ type: "reveal_fact", factId: "broken_watch", reason: "Inspected silver_watch." }],
      trace: { contextIds: ["location:foyer"] }
    });

    expect(event.turnNo).toBe(1);
    expect(store.getSession(session.id)?.state.knownFacts).toEqual(["broken_watch"]);
    expect(store.listEvents(session.id)).toHaveLength(1);
  });

  it("writes to a workspace file database without deleting journal files", () => {
    const store = createSqliteStore(join(".tmp", `sqlite-store-workspace-${randomUUID()}.db`));
    const session = store.createSession({
      packId: "rain-tower",
      initialState
    });

    expect(store.getSession(session.id)?.packId).toBe("rain-tower");
  });

  it("creates parent directories for file databases", () => {
    const root = mkdtempSync(join(tmpdir(), "aigame-store-"));
    const dbPath = join(root, "nested", "store.db");
    const store = createSqliteStore(dbPath);
    const session = store.createSession({
      packId: "rain-tower",
      initialState
    });

    expect(store.getSession(session.id)?.packId).toBe("rain-tower");
    expect(existsSync(dbPath)).toBe(true);
  });
});

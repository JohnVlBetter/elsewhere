import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = {
  AIGAME_SESSION_ROOT: process.env.AIGAME_SESSION_ROOT,
  AIGAME_MODEL_PROVIDER: process.env.AIGAME_MODEL_PROVIDER
};

describe("POST /api/turn", () => {
  afterEach(() => {
    restoreEnv("AIGAME_SESSION_ROOT", originalEnv.AIGAME_SESSION_ROOT);
    restoreEnv("AIGAME_MODEL_PROVIDER", originalEnv.AIGAME_MODEL_PROVIDER);
    vi.doUnmock("@aigame/runtime");
    vi.resetModules();
  });

  it("filters debug timeline events from the JSON turn response", async () => {
    vi.resetModules();
    process.env.AIGAME_SESSION_ROOT = mkdtempSync(join(tmpdir(), `turn-route-${randomUUID()}-`));
    process.env.AIGAME_MODEL_PROVIDER = "fake";
    mockRuntimeTurnWithDebugEvent();

    const { POST: createSession } = await import("../session/route");
    const sessionResponse = await createSession(new Request("http://test.local/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packId: "rain-tower" })
    }));
    const sessionBody = await sessionResponse.json() as { sessionId: string };

    const { POST } = await import("./route");
    const response = await POST(new Request("http://test.local/api/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionBody.sessionId, inputText: "look" })
    }) as Parameters<typeof POST>[0]);
    const body = await response.json() as { timelineEvents: Array<{ kind: string; text: string }> };

    expect(response.status).toBe(200);
    expect(body.timelineEvents.map((event) => event.kind)).toEqual(["scene"]);
    expect(JSON.stringify(body.timelineEvents)).not.toContain("Runtime model");
  });
});

function mockRuntimeTurnWithDebugEvent() {
  vi.doMock("@aigame/runtime", () => ({
    RuleBackedActionResolverProvider: class RuleBackedActionResolverProvider {
      async generateStructured<T>(): Promise<T> {
        return { actions: [{ rawText: "look", action: { type: "look", rawText: "look" } }] } as T;
      }
    },
    runTurn: vi.fn(async (input: { state: { turn: number }; inputText: string }) => ({
      action: { type: "look", rawText: input.inputText },
      outputText: "Visible turn result.",
      messages: [],
      timelineEvents: [
        {
          id: "evt_scene",
          kind: "scene",
          text: "Visible turn result.",
          timestamp: "2026-05-29T12:00:00.000Z",
          visibleToPlayer: true
        },
        {
          id: "evt_debug",
          kind: "debug",
          text: "Runtime model: fake-provider",
          timestamp: "2026-05-29T12:00:00.000Z",
          visibleToPlayer: true
        }
      ],
      state: { ...input.state, turn: input.state.turn + 1 },
      acceptedPatches: [],
      rejectedPatches: [],
      trace: { modelName: "fake" }
    }))
  }));
}

function restoreEnv(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

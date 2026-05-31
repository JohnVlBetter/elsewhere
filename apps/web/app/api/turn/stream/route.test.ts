import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatTurnFailure, TurnRequestError } from "../../../../src/server/turnService";

const originalEnv = {
  AIGAME_SESSION_ROOT: process.env.AIGAME_SESSION_ROOT,
  AIGAME_MODEL_PROVIDER: process.env.AIGAME_MODEL_PROVIDER
};

describe("POST /api/turn/stream", () => {
  afterEach(() => {
    restoreEnv("AIGAME_SESSION_ROOT", originalEnv.AIGAME_SESSION_ROOT);
    restoreEnv("AIGAME_MODEL_PROVIDER", originalEnv.AIGAME_MODEL_PROVIDER);
    vi.doUnmock("@aigame/runtime");
    vi.resetModules();
  });

  it("streams progress status events before the final turn result", async () => {
    vi.resetModules();
    process.env.AIGAME_SESSION_ROOT = mkdtempSync(join(tmpdir(), `stream-route-${randomUUID()}-`));
    process.env.AIGAME_MODEL_PROVIDER = "fake";

    const { POST: createSession } = await import("../../session/route");
    const sessionResponse = await createSession(new Request("http://test.local/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packId: "rain-tower" })
    }));
    const sessionBody = await sessionResponse.json() as { sessionId: string };

    const { POST } = await import("./route");
    const request = new Request("http://test.local/api/turn/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionBody.sessionId, inputText: "look" })
    });

    const response = await POST(request as Parameters<typeof POST>[0]);
    const text = await response.text();

    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(text).toContain("event: status");
    expect(text).toContain("\"message\":\"文字正在延展\"");
    expect(text).not.toContain("调用模型");
    expect(text).toContain("event: result");
    expect(text).toContain("\"timelineEvents\"");
  });

  it("filters debug timeline events from the streamed result payload", async () => {
    vi.resetModules();
    process.env.AIGAME_SESSION_ROOT = mkdtempSync(join(tmpdir(), `stream-route-${randomUUID()}-`));
    process.env.AIGAME_MODEL_PROVIDER = "fake";
    mockRuntimeTurnWithDebugEvent();

    const { POST: createSession } = await import("../../session/route");
    const sessionResponse = await createSession(new Request("http://test.local/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packId: "rain-tower" })
    }));
    const sessionBody = await sessionResponse.json() as { sessionId: string };

    const { POST } = await import("./route");
    const request = new Request("http://test.local/api/turn/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionBody.sessionId, inputText: "look" })
    });

    const response = await POST(request as Parameters<typeof POST>[0]);
    const text = await response.text();

    expect(text).toContain("event: result");
    expect(text).toContain("\"kind\":\"scene\"");
    expect(text).not.toContain("\"kind\":\"debug\"");
    expect(text).not.toContain("Runtime model");
  });

  it("streams each action result before the final turn completion event", async () => {
    vi.resetModules();
    process.env.AIGAME_SESSION_ROOT = mkdtempSync(join(tmpdir(), `stream-route-${randomUUID()}-`));
    process.env.AIGAME_MODEL_PROVIDER = "fake";

    const { POST: createSession } = await import("../../session/route");
    const sessionResponse = await createSession(new Request("http://test.local/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packId: "rain-tower" })
    }));
    const sessionBody = await sessionResponse.json() as { sessionId: string };

    const { POST } = await import("./route");
    const response = await POST(new Request("http://test.local/api/turn/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionBody.sessionId, inputText: "检查怀表并走向书房" })
    }) as Parameters<typeof POST>[0]);
    const text = await response.text();

    expect(text).toContain("event: turn:start");
    expect(text).toContain("event: action:start");
    expect(text).toContain("event: action:result");
    expect(text).toContain("event: turn:done");
    expect(text.indexOf("event: action:result")).toBeLessThan(text.indexOf("event: turn:done"));
  });

  it("formats known stream failures without exposing runtime internals", () => {
    const failures = [
      {
        error: new Error("Model response content was not valid JSON"),
        copy: "刚才的回应没有整理成可继续的故事，行动没有生效；请重试。"
      },
      {
        error: new Error("Model request failed: 503"),
        copy: "故事暂时没有继续，刚才的行动没有生效；请稍后重试。"
      },
      {
        error: new Error("No runtime model provider configured"),
        copy: "故事还没有准备好，暂时不能继续。"
      }
    ];

    for (const failure of failures) {
      const result = formatTurnFailure(failure.error);

      expect(result.error).toBe(failure.copy);
      expect(result.error).not.toMatch(/模型|DEEPSEEK|AIGAME_MODEL_PROVIDER|provider|Runtime/);
    }
  });

  it("formats turn request failures without exposing server internals", () => {
    const failures = [
      new TurnRequestError("Invalid turn request", 400),
      new TurnRequestError("Session not found", 404),
      new TurnRequestError("Turn request was cancelled", 499)
    ];

    for (const failure of failures) {
      const result = formatTurnFailure(failure);

      expect(result.error).toBe("行动没有成功提交，请重试。");
      expect(result.error).not.toMatch(/Invalid turn request|Session not found|cancelled|Turn request/);
    }
  });
});

function restoreEnv(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

function mockRuntimeTurnWithDebugEvent() {
  const buildResult = (input: { state: { turn: number }; inputText: string }) => ({
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
  });

  vi.doMock("@aigame/runtime", () => ({
    RuleBackedActionResolverProvider: class RuleBackedActionResolverProvider {
      async generateStructured<T>(): Promise<T> {
        return { actions: [{ rawText: "look", action: { type: "look", rawText: "look" } }] } as T;
      }
    },
    runTurn: vi.fn(async (input: { state: { turn: number }; inputText: string }) => buildResult(input)),
    runMultiActionTurn: vi.fn(async (input: {
      state: { turn: number };
      inputText: string;
      onActionStart?: (event: { actionIndex: number; inputText: string }) => void;
      onActionResult?: (event: { actionIndex: number; inputText: string; result: ReturnType<typeof buildResult> }) => void | Promise<void>;
    }) => {
      input.onActionStart?.({ actionIndex: 0, inputText: input.inputText });
      const result = buildResult(input);
      await input.onActionResult?.({ actionIndex: 0, inputText: input.inputText, result });
      return { actionResults: [result], state: result.state };
    })
  }));
}

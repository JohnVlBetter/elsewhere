import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = {
  AIGAME_SESSION_ROOT: process.env.AIGAME_SESSION_ROOT,
  AIGAME_MODEL_PROVIDER: process.env.AIGAME_MODEL_PROVIDER
};

describe("POST /api/turn/stream", () => {
  afterEach(() => {
    restoreEnv("AIGAME_SESSION_ROOT", originalEnv.AIGAME_SESSION_ROOT);
    restoreEnv("AIGAME_MODEL_PROVIDER", originalEnv.AIGAME_MODEL_PROVIDER);
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
});

function restoreEnv(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

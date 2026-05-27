import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = {
  AIGAME_DB_PATH: process.env.AIGAME_DB_PATH,
  AIGAME_MODEL_PROVIDER: process.env.AIGAME_MODEL_PROVIDER
};

describe("POST /api/turn/stream", () => {
  afterEach(() => {
    restoreEnv("AIGAME_DB_PATH", originalEnv.AIGAME_DB_PATH);
    restoreEnv("AIGAME_MODEL_PROVIDER", originalEnv.AIGAME_MODEL_PROVIDER);
    vi.resetModules();
  });

  it("streams progress status events before the final turn result", async () => {
    vi.resetModules();
    process.env.AIGAME_DB_PATH = join(mkdtempSync(join(tmpdir(), `stream-route-${randomUUID()}-`)), "session.db");
    process.env.AIGAME_MODEL_PROVIDER = "fake";

    const { POST: createSession } = await import("../../session/route");
    const sessionResponse = await createSession();
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
    expect(text).toContain("\"message\":\"行动已接收，正在整理上下文...\"");
    expect(text).toContain("\"message\":\"正在调用模型...\"");
    expect(text).toContain("event: result");
    expect(text).toContain("\"outputText\":\"现场暂时没有新的变化。\"");
  });
});

function restoreEnv(name: keyof typeof originalEnv, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

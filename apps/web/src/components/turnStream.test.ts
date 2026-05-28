import { describe, expect, it } from "vitest";
import { readTurnEventStream } from "./turnStream";

function streamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    }
  }), {
    headers: { "content-type": "text/event-stream" }
  });
}

describe("readTurnEventStream", () => {
  it("reports status events and returns the final result event", async () => {
    const statuses: string[] = [];
    const response = streamResponse([
      "event: status\ndata: {\"message\":\"行动已接收\"}\n\n",
      "event: res",
      "ult\ndata: {\"outputText\":\"管家避开了你的目光。\"}\n\n"
    ]);

    const result = await readTurnEventStream<{ outputText: string }>(response, {
      onStatus: (message) => statuses.push(message)
    });

    expect(statuses).toEqual(["行动已接收"]);
    expect(result.outputText).toBe("管家避开了你的目光。");
  });

  it("maps internal runtime status labels to player-safe copy", async () => {
    const statuses: string[] = [];
    const response = streamResponse([
      "event: status\ndata: {\"message\":\"正在调用模型...\"}\n\n",
      "event: result\ndata: {\"outputText\":\"done\"}\n\n"
    ]);

    await readTurnEventStream<{ outputText: string }>(response, {
      onStatus: (message) => statuses.push(message)
    });

    expect(statuses).toEqual(["文字正在延展"]);
  });

  it("throws the server-provided error event message", async () => {
    const response = streamResponse([
      "event: error\ndata: {\"message\":\"模型返回内容不完整，请重试。\"}\n\n"
    ]);

    await expect(readTurnEventStream(response, {})).rejects.toThrow("模型返回内容不完整，请重试。");
  });

  it("throws a response error body when the stream request is rejected before SSE starts", async () => {
    const response = new Response(JSON.stringify({ error: "Session not found" }), {
      status: 404,
      headers: { "content-type": "application/json" }
    });

    await expect(readTurnEventStream(response, {})).rejects.toThrow("Session not found");
  });
});

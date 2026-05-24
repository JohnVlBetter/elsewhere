import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAICompatibleProvider } from "./cloudProvider";

describe("OpenAICompatibleProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("can request DeepSeek JSON output mode", async () => {
    const requests: unknown[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      requests.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                narration: "The tower answers.",
                spokenBy: [],
                proposedPatches: [],
                privateNotes: "ok"
              })
            }
          }
        ]
      }));
    });

    const provider = new OpenAICompatibleProvider({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com",
      responseFormat: "json_object"
    });

    await provider.generateStructured({
      model: "deepseek-v4-pro",
      system: "Return JSON.",
      messages: [{ role: "user", content: "look" }],
      schema: { type: "object" }
    });

    expect(requests[0]).toMatchObject({
      model: "deepseek-v4-pro",
      response_format: { type: "json_object" }
    });
  });
});

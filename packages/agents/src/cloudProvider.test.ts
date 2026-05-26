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

  it("retries once when the provider returns a choice without message content", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ choices: [{ message: { role: "assistant" } }] }));
      }

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                narration: "The second response is usable.",
                spokenBy: [],
                proposedPatches: [],
                privateNotes: "retried"
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

    const result = await provider.generateStructured<{
      narration: string;
      spokenBy: unknown[];
      proposedPatches: unknown[];
      privateNotes: string;
    }>({
      model: "deepseek-v4-pro",
      system: "Return JSON.",
      messages: [{ role: "user", content: "look" }],
      schema: { type: "object" }
    });

    expect(calls).toBe(2);
    expect(result.narration).toBe("The second response is usable.");
  });

  it("retries once when the provider returns malformed JSON content", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({
          choices: [
            {
              message: {
                content: "{\"narration\":\"The first response is cut off"
              }
            }
          ]
        }));
      }

      return new Response(JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                narration: "The second response is usable.",
                spokenBy: [],
                proposedPatches: [],
                privateNotes: "retried after bad json"
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

    const result = await provider.generateStructured<{
      narration: string;
      spokenBy: unknown[];
      proposedPatches: unknown[];
      privateNotes: string;
    }>({
      model: "deepseek-v4-pro",
      system: "Return JSON.",
      messages: [{ role: "user", content: "ask butler alibi" }],
      schema: { type: "object" }
    });

    expect(calls).toBe(2);
    expect(result.narration).toBe("The second response is usable.");
  });

  it("throws a stable model-json error after malformed JSON is retried", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({
      choices: [
        {
          message: {
            content: "{\"narration\":\"still cut off"
          }
        }
      ]
    })));

    const provider = new OpenAICompatibleProvider({
      apiKey: "test-key",
      baseUrl: "https://api.deepseek.com",
      responseFormat: "json_object"
    });

    await expect(provider.generateStructured({
      model: "deepseek-v4-pro",
      system: "Return JSON.",
      messages: [{ role: "user", content: "ask butler alibi" }],
      schema: { type: "object" }
    })).rejects.toThrow("Model response content was not valid JSON");
  });
});

import { JsonSchema, ModelProvider, RuntimeMessage } from "./modelProvider";

export class OpenAICompatibleProvider implements ModelProvider {
  constructor(private readonly options: { apiKey: string; baseUrl: string }) {}

  async generateStructured<T>(request: {
    model: string;
    system: string;
    messages: RuntimeMessage[];
    schema: JsonSchema;
    temperature?: number;
    maxTokens?: number;
  }): Promise<T> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1000,
        messages: [
          { role: "system", content: request.system },
          ...request.messages
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "agent_response",
            schema: request.schema
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Model request failed: ${response.status} ${await response.text()}`);
    }

    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Model response did not include message content");
    }
    return JSON.parse(content) as T;
  }
}

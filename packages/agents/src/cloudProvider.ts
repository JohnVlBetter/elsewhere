import type { JsonSchema, ModelProvider, RuntimeMessage } from "./modelProvider";

export type StructuredResponseFormat = "json_schema" | "json_object";

export class OpenAICompatibleProvider implements ModelProvider {
  constructor(private readonly options: {
    apiKey: string;
    baseUrl: string;
    responseFormat?: StructuredResponseFormat;
  }) {}

  async generateStructured<T>(request: {
    model: string;
    system: string;
    messages: RuntimeMessage[];
    schema: JsonSchema;
    temperature?: number;
    maxTokens?: number;
  }): Promise<T> {
    let lastBody: unknown;
    let lastParseError: unknown;
    let lastContent: string | undefined;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const body = await this.requestChatCompletion(request);
      lastBody = body;
      const content = body.choices?.[0]?.message?.content;
      if (content) {
        lastContent = content;
        try {
          return JSON.parse(content) as T;
        } catch (error) {
          lastParseError = error;
        }
      }
    }

    if (lastParseError) {
      throw new Error(
        `Model response content was not valid JSON: ${formatParseError(lastParseError)}; content=${summarizeContent(lastContent)}`,
        { cause: lastParseError }
      );
    }

    throw new Error(`Model response did not include message content: ${JSON.stringify(lastBody)}`);
  }

  private async requestChatCompletion(request: {
    model: string;
    system: string;
    messages: RuntimeMessage[];
    schema: JsonSchema;
    temperature?: number;
    maxTokens?: number;
  }): Promise<{ choices?: Array<{ message?: { content?: string } }> }> {
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
        response_format: this.buildResponseFormat(request.schema)
      })
    });

    if (!response.ok) {
      throw new Error(`Model request failed: ${response.status} ${await response.text()}`);
    }

    return await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  }

  private buildResponseFormat(schema: JsonSchema): Record<string, unknown> {
    if (this.options.responseFormat === "json_object") {
      return { type: "json_object" };
    }

    return {
      type: "json_schema",
      json_schema: {
        name: "agent_response",
        schema
      }
    };
  }
}

function formatParseError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function summarizeContent(content: string | undefined): string {
  if (!content) return "<empty>";
  return JSON.stringify(content.length > 180 ? `${content.slice(0, 180)}...` : content);
}

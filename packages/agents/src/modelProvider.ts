export interface RuntimeMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface ModelProvider {
  generateStructured<T>(request: {
    model: string;
    system: string;
    messages: RuntimeMessage[];
    schema: JsonSchema;
    temperature?: number;
    maxTokens?: number;
    signal?: AbortSignal;
  }): Promise<T>;
}

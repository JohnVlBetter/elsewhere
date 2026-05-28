import { FakeModelProvider, OpenAICompatibleProvider } from "@aigame/agents";
import type { ModelProvider } from "@aigame/agents";

type EnvLike = Record<string, string | undefined>;

export interface RuntimeModelConfig {
  model: ModelProvider;
  modelName: string;
  providerName: "deepseek" | "openai-compatible" | "fake";
}

export class RuntimeModelConfigurationError extends Error {
  constructor(message = "No runtime model provider configured") {
    super(message);
    this.name = "RuntimeModelConfigurationError";
  }
}

export function createRuntimeModelConfig(env: EnvLike = process.env): RuntimeModelConfig {
  if (env.AIGAME_MODEL_PROVIDER === "fake") {
    return {
      providerName: "fake",
      modelName: "fake",
      model: new FakeModelProvider()
    };
  }

  if (env.DEEPSEEK_API_KEY) {
    return {
      providerName: "deepseek",
      modelName: env.DEEPSEEK_MODEL ?? env.AIGAME_MODEL ?? "deepseek-v4-pro",
      model: new OpenAICompatibleProvider({
        apiKey: env.DEEPSEEK_API_KEY,
        baseUrl: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
        responseFormat: "json_object"
      })
    };
  }

  if (env.OPENAI_COMPATIBLE_API_KEY && env.OPENAI_COMPATIBLE_BASE_URL) {
    return {
      providerName: "openai-compatible",
      modelName: env.OPENAI_COMPATIBLE_MODEL ?? env.AIGAME_MODEL ?? "gpt-4.1-mini",
      model: new OpenAICompatibleProvider({
        apiKey: env.OPENAI_COMPATIBLE_API_KEY,
        baseUrl: env.OPENAI_COMPATIBLE_BASE_URL
      })
    };
  }

  throw new RuntimeModelConfigurationError();
}

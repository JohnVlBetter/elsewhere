import { FakeModelProvider, OpenAICompatibleProvider } from "@aigame/agents";
import type { ModelProvider } from "@aigame/agents";
import { RuleBackedActionResolverProvider } from "@aigame/runtime";

type EnvLike = Record<string, string | undefined>;

export interface RuntimeModelConfig {
  model: ModelProvider;
  modelName: string;
  actionResolverModel: ModelProvider;
  actionResolverModelName: string;
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
      model: new FakeModelProvider(),
      actionResolverModelName: "fake-action-resolver",
      actionResolverModel: new RuleBackedActionResolverProvider()
    };
  }

  if (env.DEEPSEEK_API_KEY) {
    const provider = new OpenAICompatibleProvider({
      apiKey: env.DEEPSEEK_API_KEY,
      baseUrl: env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      responseFormat: "json_object"
    });

    return {
      providerName: "deepseek",
      modelName: env.DEEPSEEK_NARRATIVE_MODEL ?? env.AIGAME_NARRATIVE_MODEL ?? env.DEEPSEEK_MODEL ?? env.AIGAME_MODEL ?? "deepseek-v4-pro",
      model: provider,
      actionResolverModelName: env.DEEPSEEK_ACTION_MODEL ?? env.AIGAME_ACTION_MODEL ?? "deepseek-v4-flash",
      actionResolverModel: provider
    };
  }

  if (env.OPENAI_COMPATIBLE_API_KEY && env.OPENAI_COMPATIBLE_BASE_URL) {
    const provider = new OpenAICompatibleProvider({
      apiKey: env.OPENAI_COMPATIBLE_API_KEY,
      baseUrl: env.OPENAI_COMPATIBLE_BASE_URL
    });

    return {
      providerName: "openai-compatible",
      modelName: env.OPENAI_COMPATIBLE_MODEL ?? env.AIGAME_MODEL ?? "gpt-4.1-mini",
      model: provider,
      actionResolverModelName: env.OPENAI_COMPATIBLE_ACTION_MODEL ?? env.AIGAME_ACTION_MODEL ?? env.OPENAI_COMPATIBLE_MODEL ?? env.AIGAME_MODEL ?? "gpt-4.1-mini",
      actionResolverModel: provider
    };
  }

  throw new RuntimeModelConfigurationError();
}

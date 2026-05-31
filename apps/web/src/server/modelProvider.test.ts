import { describe, expect, it } from "vitest";
import { FakeModelProvider, OpenAICompatibleProvider } from "@aigame/agents";
import { RuleBackedActionResolverProvider } from "@aigame/runtime";
import { createRuntimeModelConfig } from "./modelProvider";

describe("createRuntimeModelConfig", () => {
  it("uses DeepSeek when DEEPSEEK_API_KEY is configured", () => {
    const config = createRuntimeModelConfig({
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_MODEL: "deepseek-v4-pro"
    });

    expect(config.providerName).toBe("deepseek");
    expect(config.modelName).toBe("deepseek-v4-pro");
    expect(config.actionResolverModelName).toBe("deepseek-v4-flash");
    expect(config.model).toBeInstanceOf(OpenAICompatibleProvider);
    expect(config.actionResolverModel).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it("allows DeepSeek narrative and action resolver models to be configured separately", () => {
    const config = createRuntimeModelConfig({
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_NARRATIVE_MODEL: "deepseek-v4-pro",
      DEEPSEEK_ACTION_MODEL: "deepseek-v4-flash"
    });

    expect(config.modelName).toBe("deepseek-v4-pro");
    expect(config.actionResolverModelName).toBe("deepseek-v4-flash");
  });

  it("allows tests to force the fake provider even when cloud keys exist", () => {
    const config = createRuntimeModelConfig({
      AIGAME_MODEL_PROVIDER: "fake",
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_MODEL: "deepseek-v4-pro"
    });

    expect(config.providerName).toBe("fake");
    expect(config.modelName).toBe("fake");
    expect(config.actionResolverModelName).toBe("fake-action-resolver");
    expect(config.model).toBeInstanceOf(FakeModelProvider);
    expect(config.actionResolverModel).toBeInstanceOf(RuleBackedActionResolverProvider);
  });

  it("requires an explicit fake provider when no cloud key is configured", () => {
    expect(() => createRuntimeModelConfig({})).toThrow("No runtime model provider configured");
  });
});

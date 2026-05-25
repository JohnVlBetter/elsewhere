import { describe, expect, it } from "vitest";
import { FakeModelProvider, OpenAICompatibleProvider } from "@aigame/agents";
import { createRuntimeModelConfig } from "./modelProvider";

describe("createRuntimeModelConfig", () => {
  it("uses DeepSeek when DEEPSEEK_API_KEY is configured", () => {
    const config = createRuntimeModelConfig({
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_MODEL: "deepseek-v4-pro"
    });

    expect(config.providerName).toBe("deepseek");
    expect(config.modelName).toBe("deepseek-v4-pro");
    expect(config.model).toBeInstanceOf(OpenAICompatibleProvider);
  });

  it("allows tests to force the fake provider even when cloud keys exist", () => {
    const config = createRuntimeModelConfig({
      AIGAME_MODEL_PROVIDER: "fake",
      DEEPSEEK_API_KEY: "test-key",
      DEEPSEEK_MODEL: "deepseek-v4-pro"
    });

    expect(config.providerName).toBe("fake");
    expect(config.modelName).toBe("fake");
    expect(config.model).toBeInstanceOf(FakeModelProvider);
  });

  it("falls back to the fake provider without a cloud key", () => {
    const config = createRuntimeModelConfig({});

    expect(config.providerName).toBe("fake");
    expect(config.modelName).toBe("fake");
    expect(config.model).toBeInstanceOf(FakeModelProvider);
  });
});

import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { configureWebSmokeEnvironment } = require("../../../scripts/web-smoke-env.cjs") as {
  configureWebSmokeEnvironment: (env: Record<string, string | undefined>) => void;
};

describe("configureWebSmokeEnvironment", () => {
  it("uses deterministic production smoke defaults", () => {
    const env: Record<string, string | undefined> = {};

    configureWebSmokeEnvironment(env);

    expect(env.NODE_ENV).toBe("production");
    expect(env.AIGAME_DB_PATH).toBe(":memory:");
    expect(env.AIGAME_MODEL_PROVIDER).toBe("fake");
    expect(env.NEXT_PRIVATE_START_TIME).toMatch(/^\d+$/);
  });

  it("does not replace an explicitly configured model provider", () => {
    const env: Record<string, string | undefined> = {
      AIGAME_MODEL_PROVIDER: "openai-compatible"
    };

    configureWebSmokeEnvironment(env);

    expect(env.AIGAME_MODEL_PROVIDER).toBe("openai-compatible");
  });
});

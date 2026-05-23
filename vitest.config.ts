import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "apps/**/*.test.tsx"],
    environment: "node"
  },
  resolve: {
    alias: {
      "@aigame/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@aigame/pack": fileURLToPath(new URL("./packages/pack/src/index.ts", import.meta.url)),
      "@aigame/rules": fileURLToPath(new URL("./packages/rules/src/index.ts", import.meta.url)),
      "@aigame/memory": fileURLToPath(new URL("./packages/memory/src/index.ts", import.meta.url)),
      "@aigame/persistence": fileURLToPath(new URL("./packages/persistence/src/index.ts", import.meta.url)),
      "@aigame/agents": fileURLToPath(new URL("./packages/agents/src/index.ts", import.meta.url)),
      "@aigame/runtime": fileURLToPath(new URL("./packages/runtime/src/index.ts", import.meta.url))
    }
  }
});

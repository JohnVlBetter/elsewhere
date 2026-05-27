import { defineConfig } from "@playwright/test";

const e2ePort = Number(process.env.PLAYWRIGHT_PORT ?? "3107");
const e2eBaseUrl = `http://127.0.0.1:${e2ePort}`;

export default defineConfig({
  testDir: "apps/web/tests",
  webServer: {
    command: `node --require ./scripts/sandbox-node-compat.cjs ./scripts/next-dev-fake-provider.cjs --port ${e2ePort} --hostname 127.0.0.1`,
    url: e2eBaseUrl,
    reuseExistingServer: true,
    timeout: 120000
  },
  use: {
    baseURL: e2eBaseUrl
  }
});

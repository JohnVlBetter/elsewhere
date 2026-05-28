import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const compat = require("../../../scripts/sandbox-node-compat.cjs") as {
  isGeneratedOutputPath(path: string): boolean;
};

describe("sandbox node compatibility helpers", () => {
  it("limits filesystem fallbacks to generated build and test output", () => {
    expect(compat.isGeneratedOutputPath("apps/web/.next/app-path-routes-manifest.json")).toBe(true);
    expect(compat.isGeneratedOutputPath("apps/web/.next-build/export/_next/chunk")).toBe(true);
    expect(compat.isGeneratedOutputPath("test-results/.last-run.json")).toBe(true);
    expect(compat.isGeneratedOutputPath(".tmp/sessions/session-1/state.json.tmp")).toBe(true);
    expect(compat.isGeneratedOutputPath(".tmp/sessions/session-1/state.json")).toBe(true);
    expect(compat.isGeneratedOutputPath("packages/shared/src/domain.ts")).toBe(false);
  });
});

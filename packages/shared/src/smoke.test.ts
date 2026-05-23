import { describe, expect, it } from "vitest";
import { workspaceReady } from "./index";

describe("workspace", () => {
  it("loads TypeScript workspace modules", () => {
    expect(workspaceReady).toBe(true);
  });
});

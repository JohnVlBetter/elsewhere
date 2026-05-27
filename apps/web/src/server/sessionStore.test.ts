import { describe, expect, it } from "vitest";
import { resolveWebSessionRoot } from "./sessionStore";

describe("resolveWebSessionRoot", () => {
  it("keeps the default web session logs under the ignored temp directory", () => {
    expect(resolveWebSessionRoot({})).toBe(".tmp/sessions");
  });

  it("allows the web session log root to be configured by environment", () => {
    expect(resolveWebSessionRoot({ AIGAME_SESSION_ROOT: "custom-sessions" })).toBe("custom-sessions");
  });
});

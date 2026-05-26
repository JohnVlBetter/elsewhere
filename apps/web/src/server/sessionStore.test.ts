import { describe, expect, it } from "vitest";
import { resolveWebDbPath } from "./sessionStore";

describe("resolveWebDbPath", () => {
  it("keeps the default web database under the ignored temp directory", () => {
    expect(resolveWebDbPath({})).toBe(".tmp/aigame.db");
  });

  it("allows the web database path to be configured by environment", () => {
    expect(resolveWebDbPath({ AIGAME_DB_PATH: "custom.db" })).toBe("custom.db");
  });
});

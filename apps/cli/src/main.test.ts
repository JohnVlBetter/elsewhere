import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import { isMainModule, runCli } from "./main";

describe("CLI", () => {
  it("validates the sample pack", async () => {
    const result = await runCli(["validate", "packs/rain-tower"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Pack valid: rain-tower");
  });

  it("shows simulation output", async () => {
    const result = await runCli(["simulate", "packs/rain-tower", "packs/rain-tower/scripts/true-path.yaml"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Simulation completed");
  });

  it("detects the executable module when argv uses a Windows file path", () => {
    const argvPath = "E:\\WorkSpace\\elsewhere\\apps\\cli\\src\\main.ts";

    expect(isMainModule(pathToFileURL(argvPath).href, argvPath)).toBe(true);
  });
});

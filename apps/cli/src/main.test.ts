import { describe, expect, it } from "vitest";
import { runCli } from "./main";

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
});

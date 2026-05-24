import { pathToFileURL } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("plays a turn and exposes state, clues, and last trace", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "aigame-cli-")), "cli.db");
    const play = await runCli(["play", "packs/rain-tower", "inspect", "broken_watch"], { dbPath });

    expect(play.exitCode).toBe(0);
    expect(play.stdout).toContain("Turn: 1");
    expect(play.stdout).toContain("Accepted patches: discover_clue broken_watch");
    const sessionId = play.stdout.match(/Session: ([a-f0-9-]+)/)?.[1];
    expect(sessionId).toBeDefined();

    const state = await runCli(["state", sessionId!], { dbPath });
    expect(state.exitCode).toBe(0);
    expect(state.stdout).toContain("Location: foyer");
    expect(state.stdout).toContain("Turn: 1");

    const clues = await runCli(["clues", sessionId!], { dbPath });
    expect(clues.exitCode).toBe(0);
    expect(clues.stdout).toContain("- broken_watch");

    const trace = await runCli(["trace", "last", sessionId!], { dbPath });
    expect(trace.exitCode).toBe(0);
    expect(trace.stdout).toContain("Context IDs: location:foyer");
    expect(trace.stdout).toContain("Accepted patches: 1");
    expect(trace.stdout).toContain('"type":"inspect"');
  });

  it("starts a file-backed play session with the default CLI database", async () => {
    const result = await runCli(["play", "packs/rain-tower", "look"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Session:");
    expect(result.stdout).toContain("Turn: 1");
  });

  it("continues a CLI play session by id", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "aigame-cli-")), "cli.db");
    const first = await runCli(["play", "packs/rain-tower", "look"], { dbPath });
    const sessionId = first.stdout.match(/Session: ([a-f0-9-]+)/)?.[1];
    expect(sessionId).toBeDefined();

    const second = await runCli(["play", "packs/rain-tower", "--session", sessionId!, "move", "study"], { dbPath });
    expect(second.exitCode).toBe(0);
    expect(second.stdout).toContain("Turn: 2");

    const state = await runCli(["state", sessionId!], { dbPath });
    expect(state.stdout).toContain("Location: study");
  });

  it("detects the executable module when argv uses a Windows file path", () => {
    const argvPath = "E:\\WorkSpace\\elsewhere\\apps\\cli\\src\\main.ts";

    expect(isMainModule(pathToFileURL(argvPath).href, argvPath)).toBe(true);
  });
});

import { pathToFileURL } from "node:url";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isMainModule, resolveCliDbPath, runCli } from "./main";

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

  it("fails simulation when script assertions fail", async () => {
    const scriptPath = join(mkdtempSync(join(tmpdir(), "aigame-cli-sim-")), "script.yaml");
    writeFileSync(scriptPath, [
      "steps:",
      "  - look",
      "expectedKnownClues:",
      "  - broken_watch",
      "expectedFlags:",
      "  accused_butler: true",
      ""
    ].join("\n"));

    const result = await runCli(["simulate", "packs/rain-tower", scriptPath]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Expected known clue: broken_watch");
    expect(result.stderr).toContain("Expected flag accused_butler=true but got undefined");
  });

  it("packages the sample pack into an aipack artifact", async () => {
    const outputPath = join(mkdtempSync(join(tmpdir(), "aigame-cli-pack-")), "rain-tower.aipack");
    const result = await runCli(["pack", "packs/rain-tower", outputPath]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Packaged rain-tower");
    expect(result.stdout).toContain("Validation: ok");
    const archive = JSON.parse(readFileSync(outputPath, "utf8")) as { manifest: { id: string }; validation: { ok: boolean } };
    expect(archive.manifest.id).toBe("rain-tower");
    expect(archive.validation.ok).toBe(true);
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

  it("shows rules precheck failures in trace output", async () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "aigame-cli-")), "cli.db");
    const play = await runCli(["play", "packs/rain-tower", "move", "tower"], { dbPath });
    const sessionId = play.stdout.match(/Session: ([a-f0-9-]+)/)?.[1];
    expect(sessionId).toBeDefined();

    const trace = await runCli(["trace", "last", sessionId!], { dbPath });

    expect(trace.exitCode).toBe(0);
    expect(trace.stdout).toContain("Precheck: blocked - Location is not reachable: tower");
    expect(trace.stdout).toContain("Accepted patches: 0");
  });

  it("starts a file-backed play session with the default CLI database", async () => {
    const result = await runCli(["play", "packs/rain-tower", "look"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Session:");
    expect(result.stdout).toContain("Turn: 1");
  });

  it("keeps the default CLI database under the ignored temp directory", () => {
    const original = process.env.AIGAME_CLI_DB_PATH;
    delete process.env.AIGAME_CLI_DB_PATH;

    try {
      expect(resolveCliDbPath({})).toBe(".tmp/aigame-cli.db");
    } finally {
      if (original === undefined) {
        delete process.env.AIGAME_CLI_DB_PATH;
      } else {
        process.env.AIGAME_CLI_DB_PATH = original;
      }
    }
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

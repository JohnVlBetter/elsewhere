import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { buildPackArchive, loadWorldPack, validateWorldPack } from "@aigame/pack";
import { createSqliteStore } from "@aigame/persistence";
import { runSimulation, runTurn, type SimulationAssertions } from "@aigame/runtime";
import { ActionSchema, createInitialSessionState } from "@aigame/shared";
import type { GamePatch, SessionState } from "@aigame/shared";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface RunCliOptions {
  dbPath?: string;
}

interface SimulationScript extends SimulationAssertions {
  steps: string[];
  expectedEnding?: string;
}

export async function runCli(args: string[], options: RunCliOptions = {}): Promise<CliResult> {
  const parsed = parseOptions(args);
  const [command, packPath, scriptPath] = parsed.positionals;

  if (command === "validate" && packPath) {
    const pack = loadWorldPack(packPath);
    const validation = validateWorldPack(pack);
    if (!validation.ok) {
      return { exitCode: 1, stdout: "", stderr: validation.errors.join("\n") };
    }
    return { exitCode: 0, stdout: `Pack valid: ${pack.manifest.id}\n`, stderr: "" };
  }

  if (command === "simulate" && packPath && scriptPath) {
    const pack = loadWorldPack(packPath);
    const script = YAML.parse(readFileSync(scriptPath, "utf8")) as SimulationScript;
    const result = await runSimulation({
      pack,
      steps: script.steps,
      assertions: {
        expectedKnownFacts: script.expectedKnownFacts,
        expectedFlags: script.expectedFlags,
        expectedResources: script.expectedResources,
        expectedRelationships: script.expectedRelationships,
        expectedObjectiveStages: script.expectedObjectiveStages,
        forbiddenOutputPhrases: script.forbiddenOutputPhrases
      }
    });
    const failures = [...result.assertionFailures];
    if (script.expectedEnding && result.finalEndingId !== script.expectedEnding) {
      failures.unshift(`Expected ending ${script.expectedEnding} but got ${result.finalEndingId ?? "none"}`);
    }
    if (failures.length > 0) {
      return { exitCode: 1, stdout: "", stderr: `${failures.join("\n")}\n` };
    }
    return {
      exitCode: 0,
      stdout: `Simulation completed: ${result.turns.length} turns\nEnding: ${result.finalEndingId ?? "none"}\nKnown facts: ${result.finalState.knownFacts.join(",")}\n`,
      stderr: ""
    };
  }

  if (command === "pack" && packPath && scriptPath) {
    try {
      const result = buildPackArchive(packPath, scriptPath);
      return {
        exitCode: 0,
        stdout: [
          `Packaged ${result.manifest.id} -> ${result.outputPath}`,
          `Validation: ${result.validation.ok ? "ok" : "failed"}`,
          `Files: ${result.fileCount}`
        ].join("\n") + "\n",
        stderr: ""
      };
    } catch (error) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `${error instanceof Error ? error.message : String(error)}\n`
      };
    }
  }

  if (command === "play" && packPath && scriptPath) {
    const pack = loadWorldPack(packPath);
    const store = createSqliteStore(resolveCliDbPath(options));
    const inputText = parsed.positionals.slice(2).join(" ");
    const session = parsed.sessionId
      ? store.getSession(parsed.sessionId)
      : store.createSession({ packId: pack.manifest.id, initialState: createInitialSessionState(pack) });

    if (!session) {
      return { exitCode: 1, stdout: "", stderr: `Session not found: ${parsed.sessionId}\n` };
    }
    if (session.packId !== pack.manifest.id) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Session ${session.id} belongs to ${session.packId}, not ${pack.manifest.id}\n`
      };
    }

    const result = await runTurn({ pack, state: session.state, inputText });
    store.updateSessionState(session.id, result.state);
    store.appendEvent({
      sessionId: session.id,
      turnNo: result.state.turn,
      actor: "player",
      inputText,
      action: ActionSchema.parse(result.trace.action),
      outputText: result.outputText,
      patches: result.acceptedPatches,
      trace: {
        ...result.trace,
        acceptedPatches: result.acceptedPatches,
        rejectedPatches: result.rejectedPatches
      }
    });

    return {
      exitCode: 0,
      stdout: [
        `Session: ${session.id}`,
        `Turn: ${result.state.turn}`,
        `Output: ${result.outputText}`,
        `Accepted patches: ${formatPatchList(result.acceptedPatches)}`,
        `Rejected patches: ${result.rejectedPatches.length}`,
        `Ending: ${result.endingId ?? "none"}`
      ].join("\n") + "\n",
      stderr: ""
    };
  }

  if (command === "state" && packPath) {
    const store = createSqliteStore(resolveCliDbPath(options));
    const session = store.getSession(packPath);
    if (!session) {
      return { exitCode: 1, stdout: "", stderr: `Session not found: ${packPath}\n` };
    }
    return {
      exitCode: 0,
      stdout: formatState(session.state),
      stderr: ""
    };
  }

  if (command === "facts" && packPath) {
    const store = createSqliteStore(resolveCliDbPath(options));
    const session = store.getSession(packPath);
    if (!session) {
      return { exitCode: 1, stdout: "", stderr: `Session not found: ${packPath}\n` };
    }
    const facts = session.state.knownFacts.length > 0
      ? session.state.knownFacts.map((factId) => `- ${factId}`).join("\n")
      : "No known facts.";
    return { exitCode: 0, stdout: `${facts}\n`, stderr: "" };
  }

  if (command === "trace" && packPath === "last" && scriptPath) {
    const store = createSqliteStore(resolveCliDbPath(options));
    const events = store.listEvents(scriptPath);
    const event = events.at(-1);
    if (!event) {
      return { exitCode: 1, stdout: "", stderr: `No events found for session: ${scriptPath}\n` };
    }
    return { exitCode: 0, stdout: formatTrace(event), stderr: "" };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: [
      "Usage:",
      "  validate <packPath>",
      "  simulate <packPath> <scriptPath>",
      "  pack <packPath> <output.aipack>",
      "  play <packPath> [--session <sessionId>] <action...>",
      "  state <sessionId>",
      "  facts <sessionId>",
      "  trace last <sessionId>"
    ].join("\n") + "\n"
  };
}

export function resolveCliDbPath(options: RunCliOptions): string {
  return options.dbPath ?? process.env.AIGAME_CLI_DB_PATH ?? ".tmp/aigame-cli.db";
}

function parseOptions(args: string[]): { positionals: string[]; sessionId?: string } {
  const positionals: string[] = [];
  let sessionId: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--session") {
      sessionId = args[index + 1];
      index += 1;
    } else {
      positionals.push(args[index]);
    }
  }

  return { positionals, sessionId };
}

function formatState(state: SessionState): string {
  const flags = Object.entries(state.flags)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  const resources = Object.entries(state.resources)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  const relationships = Object.entries(state.relationships)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");
  const objectiveStages = Object.entries(state.objectiveStages)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  return [
    `Location: ${state.currentLocationId}`,
    `Turn: ${state.turn}`,
    `Inventory: ${state.inventory.length > 0 ? state.inventory.join(", ") : "empty"}`,
    `Known facts: ${state.knownFacts.length > 0 ? state.knownFacts.join(", ") : "none"}`,
    `Resources: ${resources || "none"}`,
    `Relationships: ${relationships || "none"}`,
    `Flags: ${flags || "none"}`,
    `Objective stages: ${objectiveStages || "none"}`
  ].join("\n") + "\n";
}

function formatPatchList(patches: GamePatch[]): string {
  if (patches.length === 0) return "none";
  return patches.map(formatPatch).join(", ");
}

function formatPatch(patch: GamePatch): string {
  switch (patch.type) {
    case "reveal_fact":
      return `${patch.type} ${patch.factId}`;
    case "move_location":
      return `${patch.type} ${patch.locationId}`;
    case "add_item":
    case "remove_item":
      return `${patch.type} ${patch.itemId}`;
    case "set_flag":
      return `${patch.type} ${patch.flag}=${patch.value}`;
    case "adjust_relationship":
      return `${patch.type} ${patch.characterId} ${patch.delta}`;
    case "set_resource":
      return `${patch.type} ${patch.resourceId}=${patch.value}`;
    case "adjust_resource":
      return `${patch.type} ${patch.resourceId} ${patch.delta}`;
    case "set_objective_stage":
      return `${patch.type} ${patch.objectiveId}=${patch.stage}`;
  }
  const exhaustive: never = patch;
  return exhaustive;
}

function formatTrace(event: {
  turnNo: number;
  inputText: string;
  action: unknown;
  outputText: string;
  patches: GamePatch[];
  trace: Record<string, unknown>;
}): string {
  const contextIds = Array.isArray(event.trace.contextIds) ? event.trace.contextIds.join(",") : "none";
  const precheck = formatPrecheck(event.trace.precheck);
  const acceptedPatches = Array.isArray(event.trace.acceptedPatches) ? event.trace.acceptedPatches.length : event.patches.length;
  const rejectedPatches = Array.isArray(event.trace.rejectedPatches) ? event.trace.rejectedPatches.length : 0;

  return [
    `Turn: ${event.turnNo}`,
    `Input: ${event.inputText}`,
    `Action: ${JSON.stringify(event.action)}`,
    `Precheck: ${precheck}`,
    `Context IDs: ${contextIds}`,
    `Accepted patches: ${acceptedPatches}`,
    `Rejected patches: ${rejectedPatches}`,
    `Output: ${event.outputText}`
  ].join("\n") + "\n";
}

function formatPrecheck(precheck: unknown): string {
  if (!precheck || typeof precheck !== "object") {
    return "unknown";
  }
  if ((precheck as { ok?: unknown }).ok === true) {
    return "ok";
  }
  const reason = (precheck as { reason?: unknown }).reason;
  return `blocked - ${typeof reason === "string" ? reason : "unknown reason"}`;
}

export function isMainModule(metaUrl: string, argvPath = process.argv[1]): boolean {
  return argvPath !== undefined && resolve(fileURLToPath(metaUrl)) === resolve(argvPath);
}

if (isMainModule(import.meta.url)) {
  const result = await runCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

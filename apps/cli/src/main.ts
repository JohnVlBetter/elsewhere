import { readFileSync } from "node:fs";
import YAML from "yaml";
import { loadWorldPack, validateWorldPack } from "@aigame/pack";
import { runSimulation } from "@aigame/runtime";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(args: string[]): Promise<CliResult> {
  const [command, packPath, scriptPath] = args;

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
    const script = YAML.parse(readFileSync(scriptPath, "utf8")) as { steps: string[]; expectedEnding?: string };
    const result = await runSimulation({ pack, steps: script.steps });
    if (script.expectedEnding && result.finalEndingId !== script.expectedEnding) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Expected ending ${script.expectedEnding} but got ${result.finalEndingId ?? "none"}\n`
      };
    }
    return {
      exitCode: 0,
      stdout: `Simulation completed: ${result.turns.length} turns\nEnding: ${result.finalEndingId ?? "none"}\nKnown clues: ${result.finalState.knownClues.join(",")}\n`,
      stderr: ""
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: "Usage: validate <packPath> | simulate <packPath> <scriptPath>\n"
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}

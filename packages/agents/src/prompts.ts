import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type AgentPromptRole = "narrator" | "character";

const promptDirectory = join(dirname(fileURLToPath(import.meta.url)), "prompts");
const promptCache = new Map<string, string>();

function readPrompt(name: string): string {
  const cached = promptCache.get(name);
  if (cached !== undefined) return cached;

  const text = readFileSync(join(promptDirectory, `${name}.md`), "utf8").trim();
  promptCache.set(name, text);
  return text;
}

export function buildSystemPrompt(role: AgentPromptRole): string {
  return [
    readPrompt("language"),
    readPrompt("core"),
    readPrompt(role),
    readPrompt("response")
  ].join("\n\n");
}

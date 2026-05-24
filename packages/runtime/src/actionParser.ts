import type { GameAction } from "@aigame/shared";

export function parseAction(inputText: string): GameAction {
  const rawText = inputText.trim();
  const [verb, first, ...rest] = rawText.split(/\s+/);

  if (!verb || verb === "look") return { type: "look", rawText };
  if ((verb === "go" || verb === "move") && first) return { type: "move", locationId: first, rawText };
  if ((verb === "inspect" || verb === "examine") && first) return { type: "inspect", targetId: first, rawText };
  if (verb === "ask" && first) return { type: "ask", npcId: first, topic: rest.join(" "), rawText };
  if (verb === "use" && first) return { type: "use", itemId: first, targetId: rest[1], rawText };
  if (verb === "accuse" && first) {
    const withIndex = rest.indexOf("with");
    const clueIds = withIndex >= 0 ? rest.slice(withIndex + 1) : [];
    return { type: "accuse", npcId: first, clueIds, rawText };
  }

  return { type: "unknown", rawText };
}

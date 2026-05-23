import { describe, expect, it } from "vitest";
import { loadWorldPack } from "@aigame/pack";
import { FakeModelProvider } from "@aigame/agents";
import { runSimulation } from "./simulator";

describe("runSimulation", () => {
  it("runs scripted turns against a pack", async () => {
    const pack = loadWorldPack("packs/rain-tower");
    const result = await runSimulation({
      pack,
      steps: ["inspect broken_watch"],
      model: new FakeModelProvider({
        narration: "The watch is cracked.",
        spokenBy: [],
        proposedPatches: [{ type: "discover_clue", clueId: "broken_watch", reason: "Inspected the watch." }],
        privateNotes: "simulation"
      })
    });

    expect(result.finalState.knownClues).toContain("broken_watch");
    expect(result.turns).toHaveLength(1);
  });
});

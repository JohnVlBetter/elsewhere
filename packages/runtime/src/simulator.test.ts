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

  it("asserts expected final state and hidden forbidden phrases", async () => {
    const pack = loadWorldPack("packs/rain-tower");
    const result = await runSimulation({
      pack,
      steps: ["inspect broken_watch"],
      assertions: {
        expectedKnownClues: ["broken_watch"],
        expectedFlags: { accused_butler: false },
        forbiddenOutputPhrases: ["He reset the bell"]
      },
      model: new FakeModelProvider({
        narration: "The watch is cracked.",
        spokenBy: [],
        proposedPatches: [],
        privateNotes: "simulation"
      })
    });

    expect(result.assertionFailures).toEqual([]);
  });

  it("reports assertion failures for missing state and forbidden output leaks", async () => {
    const pack = loadWorldPack("packs/rain-tower");
    const result = await runSimulation({
      pack,
      steps: ["look"],
      assertions: {
        expectedKnownClues: ["broken_watch"],
        expectedFlags: { accused_butler: true },
        forbiddenOutputPhrases: ["He reset the bell"]
      },
      model: new FakeModelProvider({
        narration: "He reset the bell in secret.",
        spokenBy: [],
        proposedPatches: [],
        privateNotes: "simulation"
      })
    });

    expect(result.assertionFailures).toEqual([
      "Expected known clue: broken_watch",
      "Expected flag accused_butler=true but got undefined",
      "Forbidden output phrase leaked: He reset the bell"
    ]);
  });
});

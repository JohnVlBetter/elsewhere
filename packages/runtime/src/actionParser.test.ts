import { describe, expect, it } from "vitest";
import { parseAction } from "./actionParser";

describe("parseAction", () => {
  it("parses movement", () => {
    expect(parseAction("go study")).toEqual({ type: "move", locationId: "study", rawText: "go study" });
  });

  it("parses inspection", () => {
    expect(parseAction("inspect silver_watch")).toEqual({ type: "inspect", targetId: "silver_watch", rawText: "inspect silver_watch" });
  });

  it("parses accusation clues", () => {
    expect(parseAction("accuse butler with broken_watch muddy_bootprint")).toEqual({
      type: "accuse",
      npcId: "butler",
      clueIds: ["broken_watch", "muddy_bootprint"],
      rawText: "accuse butler with broken_watch muddy_bootprint"
    });
  });
});

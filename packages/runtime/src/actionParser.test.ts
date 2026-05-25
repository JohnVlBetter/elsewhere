import { describe, expect, it } from "vitest";
import { parseAction } from "./actionParser";

const lexicon = {
  locations: [
    { id: "study", name: "Study", aliases: ["书房"] }
  ],
  npcs: [
    {
      id: "butler",
      name: "Mr. Vale",
      aliases: ["管家"],
      topics: [
        { id: "alibi", prompt: "Ask where he was at nine.", aliases: ["不在场证明", "行踪"] }
      ]
    }
  ],
  items: [
    { id: "silver_watch", name: "Silver Watch", aliases: ["银怀表", "怀表"] }
  ],
  clues: [
    { id: "broken_watch", name: "Broken Watch", aliases: ["破损怀表"] }
  ]
};

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

  it("parses natural Chinese NPC questions through pack aliases", () => {
    expect(parseAction("询问管家的不在场证明", lexicon)).toEqual({
      type: "ask",
      npcId: "butler",
      topic: "alibi",
      rawText: "询问管家的不在场证明"
    });
  });

  it("parses natural Chinese item pickup through pack aliases", () => {
    expect(parseAction("拿走银怀表", lexicon)).toEqual({
      type: "take",
      itemId: "silver_watch",
      rawText: "拿走银怀表"
    });
  });

  it("parses natural Chinese inspection through pack aliases", () => {
    expect(parseAction("查看怀表时间", lexicon)).toEqual({
      type: "inspect",
      targetId: "silver_watch",
      rawText: "查看怀表时间"
    });
  });
});

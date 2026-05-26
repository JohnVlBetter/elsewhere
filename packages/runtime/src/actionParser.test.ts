import { describe, expect, it } from "vitest";
import { parseAction } from "./actionParser";

const lexicon = {
  profile: {
    id: "detective",
    labels: { facts: "线索" },
    quickActions: [],
    actions: {
      confront: { aliases: ["confront", "accuse", "指认"], requiresTarget: "character" as const, acceptsFacts: true }
    }
  },
  locations: [
    { id: "study", name: "Study", aliases: ["书房"] }
  ],
  characters: [
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
  facts: [
    { id: "broken_watch", name: "Broken Watch", aliases: ["破损怀表"] },
    { id: "muddy_bootprint", name: "Muddy Bootprint", aliases: ["泥靴印"] }
  ]
};

const cultivationLexicon = {
  profile: {
    id: "cultivation",
    labels: { facts: "玄机" },
    quickActions: [],
    actions: {
      breakthrough: { aliases: ["breakthrough", "突破"], acceptsFacts: false }
    }
  },
  locations: [],
  characters: [],
  items: [],
  facts: []
};

describe("parseAction", () => {
  it("parses movement", () => {
    expect(parseAction("go study")).toEqual({ type: "move", locationId: "study", rawText: "go study" });
  });

  it("parses inspection", () => {
    expect(parseAction("inspect silver_watch")).toEqual({ type: "inspect", targetId: "silver_watch", rawText: "inspect silver_watch" });
  });

  it("parses generic talk actions", () => {
    expect(parseAction("talk butler about alibi")).toEqual({
      type: "talk",
      characterId: "butler",
      topic: "alibi",
      rawText: "talk butler about alibi"
    });
  });

  it("parses profile act actions with supporting facts", () => {
    expect(parseAction("confront butler with broken_watch muddy_bootprint", lexicon)).toEqual({
      type: "act",
      intent: "confront",
      targetId: "butler",
      factIds: ["broken_watch", "muddy_bootprint"],
      rawText: "confront butler with broken_watch muddy_bootprint"
    });
  });

  it("parses natural Chinese character questions through pack aliases", () => {
    expect(parseAction("询问管家的不在场证明", lexicon)).toEqual({
      type: "talk",
      characterId: "butler",
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

  it("parses natural Chinese profile actions", () => {
    expect(parseAction("我要突破", cultivationLexicon)).toEqual({
      type: "act",
      intent: "breakthrough",
      factIds: [],
      rawText: "我要突破"
    });
  });
});

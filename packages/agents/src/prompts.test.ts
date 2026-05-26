import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompts";

describe("core agent prompts", () => {
  it("assembles narrator prompts from generic core templates", () => {
    const system = buildSystemPrompt("narrator");

    expect(system).toContain("核心约束：context 是唯一事实来源");
    expect(system).toContain("旁白不得替当前角色发言");
    expect(system).toContain("已知事实");
    expect(system).toContain("只返回一个有效 JSON 对象");
    expect(system).toContain("reveal_fact");
    expect(system).not.toContain("discover_clue");
    expect(system).not.toContain("knownClues");
  });

  it("assembles character prompts from generic core templates", () => {
    const system = buildSystemPrompt("character");

    expect(system).toContain("核心约束：context 是唯一事实来源");
    expect(system).toContain("spokenBy 必须只包含当前角色");
    expect(system).toContain("characterId");
    expect(system).toContain("adjust_relationship");
    expect(system).not.toContain("NPC");
    expect(system).not.toContain("adjust_npc_attitude");
    expect(system).not.toContain("旁白不得替当前角色发言");
  });
});

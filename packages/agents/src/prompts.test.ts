import { describe, expect, it } from "vitest";
import { buildSystemPrompt } from "./prompts";

describe("core agent prompts", () => {
  it("assembles narrator prompts from standalone core templates", () => {
    const system = buildSystemPrompt("narrator");

    expect(system).toContain("核心约束：context 是唯一事实来源");
    expect(system).toContain("旁白不得替 NPC 发言");
    expect(system).toContain("只返回一个有效 JSON 对象");
    expect(system).not.toContain("spokenBy 必须只包含当前 NPC");
  });

  it("assembles NPC prompts from standalone core templates", () => {
    const system = buildSystemPrompt("npc");

    expect(system).toContain("核心约束：context 是唯一事实来源");
    expect(system).toContain("spokenBy 必须只包含当前 NPC");
    expect(system).toContain("只返回一个有效 JSON 对象");
    expect(system).not.toContain("旁白不得替 NPC 发言");
  });
});

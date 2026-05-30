import { describe, expect, it } from "vitest";
import { parseMarkedActionSegments, planActionSegments } from "./actionPlanner";

describe("planActionSegments", () => {
  it("splits common Chinese compound action separators", () => {
    expect(planActionSegments("检查怀表并与管家说“你好”并走向书房")).toEqual([
      "检查怀表",
      "与管家说“你好”",
      "走向书房"
    ]);
  });

  it("keeps text as one action when no separator exists", () => {
    expect(planActionSegments("检查怀表")).toEqual(["检查怀表"]);
  });

  it("parses explicit action markers from constrained planner output", () => {
    expect(parseMarkedActionSegments([
      "<ACTION_START>",
      "{\"rawText\":\"检查怀表\"}",
      "<ACTION_END>",
      "<ACTION_START>",
      "{\"rawText\":\"走向书房\"}",
      "<ACTION_END>"
    ].join("\n"))).toEqual(["检查怀表", "走向书房"]);
  });

  it("drops malformed marked segments and keeps valid ones", () => {
    expect(parseMarkedActionSegments([
      "<ACTION_START>",
      "not json",
      "<ACTION_END>",
      "<ACTION_START>",
      "{\"rawText\":\"询问管家\"}",
      "<ACTION_END>"
    ].join("\n"))).toEqual(["询问管家"]);
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { buildEntityMaps } from "./entityLabels";
import { StateSidebar } from "./StateSidebar";

const labels = {
  location: "地点",
  characters: "角色",
  facts: "发现",
  inventory: "物品",
  resources: "资源",
  relationships: "关系",
  objectives: "进展"
};

describe("StateSidebar", () => {
  afterEach(() => cleanup());

  it("renders icon-labeled player state sections with mapped labels", () => {
    const entityMaps = buildEntityMaps({
      locations: [{ id: "classroom", name: "教室", visibleCharacters: ["lin"] }],
      characters: [{ id: "lin", name: "林同学" }],
      items: [{ id: "paper_note", name: "纸条" }],
      facts: [{ id: "missed_note", name: "错放的纸条" }],
      resources: [{ id: "courage", name: "勇气" }],
      relationships: [{ id: "lin", name: "信任" }],
      objectives: [{ id: "repair_lunch", name: "修复午餐", stages: ["warm"] }]
    });

    render(<StateSidebar
      labels={labels}
      entityMaps={entityMaps}
      state={{
        currentLocationId: "classroom",
        turn: 1,
        inventory: ["paper_note"],
        knownFacts: ["missed_note"],
        resources: { courage: 2 },
        relationships: { lin: 1 },
        flags: {},
        objectiveStages: { repair_lunch: "warm" }
      }}
    />);

    expect(screen.getByLabelText("地点").textContent).toContain("教室");
    expect(screen.getByLabelText("角色").textContent).toContain("林同学");
    expect(screen.getByLabelText("物品").textContent).toContain("纸条");
    expect(document.querySelectorAll("[data-testid='state-section-icon']")).toHaveLength(7);
  });
});

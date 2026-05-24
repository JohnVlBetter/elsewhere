// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameShell } from "./GameShell";

describe("GameShell", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the player-facing panels", () => {
    render(<GameShell />);

    expect(screen.getByRole("heading", { name: "雨塔谋杀案" })).toBeTruthy();
    expect(screen.getByLabelText("行动指令")).toBeTruthy();
    expect(screen.getByRole("button", { name: "发送" })).toBeTruthy();
    expect(screen.getByText("当前位置")).toBeTruthy();
    expect(screen.getByRole("region", { name: "当前位置" })).toBeTruthy();
    expect(screen.getByText("已知线索")).toBeTruthy();
    expect(screen.getByText("随身物品")).toBeTruthy();
    expect(screen.getByText("开发追踪")).toBeTruthy();
  });

  it("shows localized agent role and raw output in the developer trace", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sessionId: "session-1",
        state: {
          currentLocationId: "foyer",
          turn: 0,
          inventory: [],
          knownClues: [],
          flags: {},
          npcAttitudes: {},
          questStages: { solve_murder: "investigate" }
        }
      })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        outputText: "Mr. Vale keeps his answer precise.",
        state: {
          currentLocationId: "foyer",
          turn: 1,
          inventory: [],
          knownClues: [],
          flags: {},
          npcAttitudes: {},
          questStages: { solve_murder: "investigate" }
        },
        acceptedPatches: [],
        rejectedPatches: [],
        trace: {
          precheck: { ok: true },
          contextIds: ["location:foyer", "npc:butler"],
          agentRole: "npc",
          modelName: "deepseek-v4-pro",
          agentRawOutput: { narration: "Mr. Vale keeps his answer precise.", privateNotes: "npc actor raw output" }
        }
      })));

    render(<GameShell />);
    await waitFor(() => expect(screen.getByRole("region", { name: "当前位置" }).textContent).toContain("门厅"));

    fireEvent.change(screen.getByLabelText("行动指令"), { target: { value: "询问管家的不在场证明" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "开发追踪" }).textContent).toContain("角色=npc");
      expect(screen.getByRole("region", { name: "开发追踪" }).textContent).toContain("模型=deepseek-v4-pro");
      expect(screen.getByRole("region", { name: "开发追踪" }).textContent).toContain("预检=通过");
      expect(screen.getByRole("region", { name: "开发追踪" }).textContent).toContain("原始输出=Mr. Vale keeps his answer precise.");
    });
  });
});

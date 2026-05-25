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
    expect(screen.getByText("运行状态")).toBeTruthy();
  });

  it("shows a localized runtime status without exposing raw agent output", async () => {
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
        outputText: "管家谨慎地回答了你的问题。",
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
      const status = screen.getByRole("region", { name: "运行状态" }).textContent;
      expect(status).toContain("处理=角色回应");
      expect(status).toContain("模型=deepseek-v4-pro");
      expect(status).toContain("校验=通过");
      expect(status).toContain("上下文=位置:门厅、角色:管家");
      expect(status).not.toContain("Mr. Vale keeps his answer precise.");
    });
  });

  it("shows the sent action and a waiting response state while a turn is pending", async () => {
    let resolveTurn: (response: Response) => void = () => {};
    const pendingTurn = new Promise<Response>((resolve) => {
      resolveTurn = resolve;
    });

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
      .mockReturnValueOnce(pendingTurn);

    render(<GameShell />);
    await waitFor(() => expect(screen.getByRole("region", { name: "当前位置" }).textContent).toContain("门厅"));

    fireEvent.change(screen.getByLabelText("行动指令"), { target: { value: "inspect broken_watch" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    expect(screen.getByText("inspect broken_watch")).toBeTruthy();
    expect(screen.getByText("已发送，等待回应...")).toBeTruthy();
    expect((screen.getByRole("button", { name: "等待回应" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("发送中")).toBeNull();

    resolveTurn(new Response(JSON.stringify({
      outputText: "怀表停在八点四十七分。",
      state: {
        currentLocationId: "foyer",
        turn: 1,
        inventory: [],
        knownClues: ["broken_watch"],
        flags: {},
        npcAttitudes: {},
        questStages: { solve_murder: "investigate" }
      },
      acceptedPatches: [],
      rejectedPatches: [],
      trace: {
        precheck: { ok: true },
        contextIds: ["location:foyer"],
        agentRole: "narrator",
        modelName: "fake",
        agentRawOutput: { narration: "怀表停在八点四十七分。", privateNotes: "test" }
      }
    })));

    await waitFor(() => {
      expect(screen.getByText("怀表停在八点四十七分。")).toBeTruthy();
      expect(screen.queryByText("已发送，等待回应...")).toBeNull();
      expect(screen.getByRole("button", { name: "发送" })).toBeTruthy();
    });
  });
});

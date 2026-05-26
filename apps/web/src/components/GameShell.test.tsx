// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GameShell } from "./GameShell";

function turnStreamResponse(events: Array<{ event: string; data: unknown }>): Response {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`));
      }
      controller.close();
    }
  }), {
    headers: { "content-type": "text/event-stream" }
  });
}

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
        intro: "你是受邀调查哈尔登爵士死亡的侦探。先确认现场、人物和时间线。",
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
      .mockResolvedValueOnce(turnStreamResponse([
        { event: "status", data: { message: "正在调用模型..." } },
        {
          event: "result",
          data: {
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
            messages: [
              { type: "narration", text: "管家谨慎地看了你一眼。" },
              { type: "npc", npcId: "butler", label: "管家", text: "我在九点时一直在书房。" },
              { type: "clue", clueId: "false_alibi", label: "虚假不在场证明", text: "管家的说法与怀表时间冲突。" }
            ],
            trace: {
              precheck: { ok: true },
              contextIds: ["location:foyer", "npc:butler"],
              agentRole: "npc",
              modelName: "deepseek-v4-pro",
              agentRawOutput: { narration: "Mr. Vale keeps his answer precise.", privateNotes: "npc actor raw output" }
            }
          }
        }
      ]));

    render(<GameShell />);
    await waitFor(() => expect(screen.getByRole("region", { name: "当前位置" }).textContent).toContain("门厅"));
    expect(screen.getByText("你是受邀调查哈尔登爵士死亡的侦探。先确认现场、人物和时间线。")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("行动指令"), { target: { value: "询问管家的不在场证明" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("管家谨慎地看了你一眼。")).toBeTruthy();
      expect(screen.getByText("我在九点时一直在书房。")).toBeTruthy();
      expect(screen.getByText("管家的说法与怀表时间冲突。")).toBeTruthy();
      expect(screen.getByText("管家")).toBeTruthy();
      expect(screen.getByText("线索")).toBeTruthy();
      const status = screen.getByRole("region", { name: "运行状态" }).textContent;
      expect(status).toContain("处理=角色回应");
      expect(status).toContain("模型=deepseek-v4-pro");
      expect(status).toContain("校验=通过");
      expect(status).toContain("上下文=位置:门厅、角色:管家");
      expect(status).not.toContain("Mr. Vale keeps his answer precise.");
    });
    expect(fetch).toHaveBeenLastCalledWith("/api/turn/stream", expect.objectContaining({ method: "POST" }));
  });

  it("shows the sent action and a waiting response state while a turn is pending", async () => {
    let resolveTurn: (response: Response) => void = () => {};
    const pendingTurn = new Promise<Response>((resolve) => {
      resolveTurn = resolve;
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({
        sessionId: "session-1",
        intro: "你是受邀调查哈尔登爵士死亡的侦探。先确认现场、人物和时间线。",
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

    resolveTurn(turnStreamResponse([
      { event: "status", data: { message: "正在写入案卷..." } },
      {
        event: "result",
        data: {
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
          messages: [{ type: "narration", text: "怀表停在八点四十七分。" }],
          trace: {
            precheck: { ok: true },
            contextIds: ["location:foyer"],
            agentRole: "narrator",
            modelName: "fake",
            agentRawOutput: { narration: "怀表停在八点四十七分。", privateNotes: "test" }
          }
        }
      }
    ]));

    await waitFor(() => {
      expect(screen.getByText("怀表停在八点四十七分。")).toBeTruthy();
      expect(screen.queryByText("已发送，等待回应...")).toBeNull();
      expect(screen.getByRole("button", { name: "发送" })).toBeTruthy();
    });
  });
});

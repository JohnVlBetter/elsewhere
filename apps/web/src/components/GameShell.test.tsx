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

function sessionBody() {
  return {
    sessionId: "session-1",
    packId: "campus-lunch",
    manifest: {
      id: "campus-lunch",
      name: "Campus Lunch",
      version: "0.2.0",
      runtimeVersion: "0.2.0",
      entryLocationId: "classroom",
      profileId: "romance"
    },
    profile: {
      id: "romance",
      labels: {
        location: "地点",
        facts: "发现",
        inventory: "物品",
        objectives: "进展",
        characters: "角色",
        resources: "资源",
        relationships: "关系"
      },
      theme: {
        tone: "cool",
        accentColor: "#4f8cff",
        backgroundColor: "#f8fbff",
        textColor: "#18202a"
      },
      assets: {
        bannerImage: "generated/banners/campus.webp"
      },
      quickActions: [
        { label: "环顾四周", command: "look" },
        { label: "指认管家", command: "confront butler", visibleWhen: { factKnown: "butler_motive" } }
      ],
      actions: {}
    },
    entities: {
      locations: [{ id: "classroom", name: "Classroom", visibleCharacters: ["lin"] }],
      characters: [{ id: "lin", name: "Lin", assets: { avatar: "generated/avatars/lin.webp" } }],
      items: [{ id: "paper_note", name: "Paper note" }],
      facts: [{ id: "missed_note", name: "Missed note" }],
      resources: [{ id: "courage", name: "Courage" }],
      relationships: [{ id: "lin", name: "Trust" }],
      objectives: [{ id: "repair_lunch", name: "Repair lunch", stages: ["awkward", "warm"] }]
    },
    intro: "Campus intro",
    state: {
      currentLocationId: "classroom",
      turn: 0,
      inventory: [],
      knownFacts: [],
      resources: { courage: 1 },
      relationships: { lin: 0 },
      flags: {},
      objectiveStages: { repair_lunch: "awkward" }
    }
  };
}

describe("GameShell", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("creates a selected pack session and hides conditional quick actions", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sessionBody())));

    render(<GameShell packId="campus-lunch" />);

    expect(await screen.findByRole("heading", { name: "Campus Lunch" })).toBeTruthy();
    expect(screen.getAllByTestId("story-stat")).toHaveLength(3);
    expect(screen.getByLabelText("故事状态").textContent).toContain("准备继续");
    expect(screen.getByTestId("game-shell").getAttribute("style")).toContain("--story-accent: #4f8cff");
    expect(document.querySelector(".game-header")?.getAttribute("style")).toContain("/generated/banners/campus.webp");
    expect(screen.getByText("Campus intro")).toBeTruthy();
    expect(screen.getByPlaceholderText("写下你的行动")).toBeTruthy();
    expect(screen.getByRole("button", { name: "发送" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "环顾四周" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "指认管家" })).toBeNull();
    expect(screen.queryByText("Runtime")).toBeNull();
    expect(document.body.textContent).not.toContain("鍑");
    expect(document.body.textContent).not.toContain("閫");
    expect(fetchSpy).toHaveBeenCalledWith("/api/session", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ packId: "campus-lunch" })
    }));
  });

  it("renders timeline events and player-facing state after a turn", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sessionBody())))
      .mockResolvedValueOnce(turnStreamResponse([
        { event: "status", data: { message: "文字正在延展" } },
        {
          event: "result",
          data: {
            outputText: "Lin answers.",
            state: {
              currentLocationId: "classroom",
              turn: 1,
              inventory: ["paper_note"],
              knownFacts: ["missed_note"],
              resources: { courage: 2 },
              relationships: { lin: 1 },
              flags: {},
              objectiveStages: { repair_lunch: "warm" }
            },
            timelineEvents: [
              { id: "evt_1", kind: "player_action", actorId: "player", text: "询问林同学", timestamp: "2026-05-28T12:00:00.000Z", visibleToPlayer: true },
              { id: "evt_2", kind: "dialogue", speakerId: "lin", speakerName: "Lin", text: "I waited by the courtyard.", timestamp: "2026-05-28T12:00:00.000Z", visibleToPlayer: true },
              { id: "evt_3", kind: "evidence", refId: "missed_note", text: "The note was tucked into the wrong book.", timestamp: "2026-05-28T12:00:00.000Z", visibleToPlayer: true },
              { id: "evt_debug", kind: "debug", text: "Runtime model: fake-provider", timestamp: "2026-05-28T12:00:00.000Z", visibleToPlayer: true }
            ],
            acceptedPatches: [],
            rejectedPatches: [],
            trace: { precheck: { ok: true }, contextIds: ["location:classroom"], agentRole: "character", modelName: "fake" }
          }
        }
      ]));

    render(<GameShell packId="campus-lunch" />);
    await screen.findByRole("heading", { name: "Campus Lunch" });

    fireEvent.change(screen.getByPlaceholderText("写下你的行动"), { target: { value: "询问林同学" } });
    fireEvent.click(screen.getByRole("button", { name: "发送" }));

    await waitFor(() => {
      expect(screen.getByText("I waited by the courtyard.")).toBeTruthy();
      expect(screen.getAllByText("Missed note").length).toBeGreaterThan(0);
      expect(screen.getByText("The note was tucked into the wrong book.")).toBeTruthy();
      expect(document.querySelector("[data-event-kind='player_action']")).toBeTruthy();
      expect(document.querySelector("[data-event-kind='dialogue']")).toBeTruthy();
      expect(document.querySelector("[data-event-kind='evidence']")).toBeTruthy();
      expect(screen.getByLabelText("发现").textContent).toContain("Missed note");
      expect(screen.getByLabelText("物品").textContent).toContain("Paper note");
      expect(screen.getByLabelText("进展").textContent).toContain("Repair lunch: warm");
      expect(screen.getByLabelText("角色").textContent).toContain("Lin");
      expect(screen.getByLabelText("资源").textContent).toContain("Courage: 2");
      expect(screen.getByLabelText("关系").textContent).toContain("Trust: 1");
      expect(document.body.textContent).not.toContain("Runtime model");
      expect(document.body.textContent).not.toContain("閫");
    });
  });
});

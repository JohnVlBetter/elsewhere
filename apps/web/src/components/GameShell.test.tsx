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
        location: "Place",
        characters: "People",
        facts: "Memories",
        inventory: "Bag",
        resources: "Stats",
        relationships: "Bonds",
        objectives: "Objectives"
      },
      quickActions: [
        { label: "Look around", command: "look" },
        { label: "Talk to Lin", command: "talk lin about lunch" }
      ],
      actions: {}
    },
    entities: {
      locations: [{ id: "classroom", name: "Classroom" }],
      characters: [{ id: "lin", name: "Lin" }],
      items: [{ id: "paper_note", name: "Paper note" }],
      facts: [{ id: "missed_note", name: "Missed note" }],
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

  it("renders labels and quick actions from the pack profile", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sessionBody())));

    render(<GameShell />);

    expect(await screen.findByRole("heading", { name: "Campus Lunch" })).toBeTruthy();
    expect(screen.getByText("Campus intro")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Memories" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Bag" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Stats" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Bonds" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Objectives" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Look around" })).toBeTruthy();
    const oldFactsLabel = ["Known", "cl" + "ues"].join(" ");
    expect(screen.queryByText(oldFactsLabel)).toBeNull();
  });

  it("shows generic turn messages, state panels, and trace summary", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sessionBody())))
      .mockResolvedValueOnce(turnStreamResponse([
        { event: "status", data: { message: "Calling model..." } },
        {
          event: "result",
          data: {
            outputText: "Lin listens.",
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
            acceptedPatches: [{ type: "reveal_fact", factId: "missed_note", reason: "Read the note." }],
            rejectedPatches: [],
            messages: [
              { type: "narration", text: "The classroom quiets." },
              { type: "character", characterId: "lin", label: "Lin", text: "I waited by the courtyard." },
              { type: "fact", factId: "missed_note", label: "Missed note", text: "The note was tucked into the wrong book." }
            ],
            trace: {
              precheck: { ok: true },
              contextIds: ["location:classroom", "character:lin"],
              agentRole: "character",
              modelName: "fake"
            }
          }
        }
      ]));

    render(<GameShell />);
    await screen.findByRole("heading", { name: "Campus Lunch" });

    fireEvent.change(screen.getByLabelText("Action command"), { target: { value: "Talk to Lin" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByText("The classroom quiets.")).toBeTruthy();
      expect(screen.getByText("I waited by the courtyard.")).toBeTruthy();
      expect(screen.getByText("The note was tucked into the wrong book.")).toBeTruthy();
      expect(screen.getByRole("region", { name: "Memories" }).textContent).toContain("Missed note");
      expect(screen.getByRole("region", { name: "Bag" }).textContent).toContain("Paper note");
      expect(screen.getByRole("region", { name: "Stats" }).textContent).toContain("courage=2");
      expect(screen.getByRole("region", { name: "Bonds" }).textContent).toContain("Lin=1");
      expect(screen.getByRole("region", { name: "Objectives" }).textContent).toContain("Repair lunch: warm");
      expect(screen.getByRole("region", { name: "Runtime" }).textContent).toContain("handler=Character");
    });
    expect(fetch).toHaveBeenLastCalledWith("/api/turn/stream", expect.objectContaining({ method: "POST" }));
  });

  it("shows the sent action and waiting state while a turn is pending", async () => {
    let resolveTurn: (response: Response) => void = () => {};
    const pendingTurn = new Promise<Response>((resolve) => {
      resolveTurn = resolve;
    });

    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(sessionBody())))
      .mockReturnValueOnce(pendingTurn);

    render(<GameShell />);
    await screen.findByRole("heading", { name: "Campus Lunch" });

    fireEvent.change(screen.getByLabelText("Action command"), { target: { value: "inspect paper_note" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(screen.getByText("inspect paper_note")).toBeTruthy();
    expect(screen.getByText("Waiting for response...")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Waiting" }) as HTMLButtonElement).disabled).toBe(true);

    resolveTurn(turnStreamResponse([
      {
        event: "result",
        data: {
          outputText: "The paper note is folded twice.",
          state: {
            currentLocationId: "classroom",
            turn: 1,
            inventory: [],
            knownFacts: ["missed_note"],
            resources: { courage: 1 },
            relationships: { lin: 0 },
            flags: {},
            objectiveStages: { repair_lunch: "awkward" }
          },
          acceptedPatches: [],
          rejectedPatches: [],
          messages: [{ type: "narration", text: "The paper note is folded twice." }],
          trace: {
            precheck: { ok: true },
            contextIds: ["location:classroom"],
            agentRole: "narrator",
            modelName: "fake"
          }
        }
      }
    ]));

    await waitFor(() => {
      expect(screen.getByText("The paper note is folded twice.")).toBeTruthy();
      expect(screen.queryByText("Waiting for response...")).toBeNull();
      expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
    });
  });
});

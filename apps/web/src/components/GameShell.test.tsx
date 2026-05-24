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

    expect(screen.getByRole("heading", { name: "Rain Tower Murder" })).toBeTruthy();
    expect(screen.getByLabelText("Action input")).toBeTruthy();
    expect(screen.getByText("Current Location")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Current Location" })).toBeTruthy();
    expect(screen.getByText("Known Clues")).toBeTruthy();
    expect(screen.getByText("Inventory")).toBeTruthy();
  });

  it("shows agent role and raw output in the developer trace", async () => {
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
          agentRawOutput: { narration: "Mr. Vale keeps his answer precise.", privateNotes: "npc actor raw output" }
        }
      })));

    render(<GameShell />);
    await waitFor(() => expect(screen.getByText("foyer")).toBeTruthy());

    fireEvent.change(screen.getByLabelText("Action input"), { target: { value: "ask butler alibi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Developer Trace" }).textContent).toContain("agent=npc");
      expect(screen.getByRole("region", { name: "Developer Trace" }).textContent).toContain("precheck=ok");
      expect(screen.getByRole("region", { name: "Developer Trace" }).textContent).toContain("raw=Mr. Vale keeps his answer precise.");
    });
  });
});

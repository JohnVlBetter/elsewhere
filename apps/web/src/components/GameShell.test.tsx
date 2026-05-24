// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameShell } from "./GameShell";

describe("GameShell", () => {
  it("renders the player-facing panels", () => {
    render(<GameShell />);

    expect(screen.getByRole("heading", { name: "Rain Tower Murder" })).toBeTruthy();
    expect(screen.getByLabelText("Action input")).toBeTruthy();
    expect(screen.getByText("Current Location")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Current Location" })).toBeTruthy();
    expect(screen.getByText("Known Clues")).toBeTruthy();
    expect(screen.getByText("Inventory")).toBeTruthy();
  });
});

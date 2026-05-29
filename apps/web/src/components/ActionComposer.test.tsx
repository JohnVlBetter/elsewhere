// @vitest-environment jsdom

import type { FormEvent } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActionComposer } from "./ActionComposer";

describe("ActionComposer", () => {
  afterEach(() => cleanup());

  it("keeps submit behavior accessible while rendering visual icon hooks", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const onInputChange = vi.fn();
    const onQuickAction = vi.fn();

    render(
      <ActionComposer
        input="询问林同学"
        isReady={true}
        isSubmitting={false}
        quickActions={[{ label: "环顾四周", command: "look" }]}
        onInputChange={onInputChange}
        onQuickAction={onQuickAction}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole("button", { name: "发送" })).toBeTruthy();
    expect(document.querySelector("[data-testid='send-icon']")).toBeTruthy();
    expect(document.querySelector("[data-testid='quick-action-icon']")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "环顾四周" }));
    expect(onQuickAction).toHaveBeenCalledWith("look");
  });
});

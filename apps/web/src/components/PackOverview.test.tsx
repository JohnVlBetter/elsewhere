// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PackOverview } from "./PackOverview";

describe("PackOverview", () => {
  afterEach(() => cleanup());

  it("renders the story library with readable Chinese copy", () => {
    render(<PackOverview packs={[{
      id: "campus-lunch",
      title: "午餐误会",
      subtitle: "campus",
      introduction: "午休铃声响起，错放的便当让两个人都停下了脚步。",
      version: "0.2.0"
    }]} />);

    expect(screen.getByRole("heading", { name: "故事库" })).toBeTruthy();
    expect(screen.getAllByRole("link", { name: /午餐误会/ }).length).toBeGreaterThan(0);
    expect(screen.getByText("开始阅读")).toBeTruthy();
    expect(document.body.textContent).not.toContain("閫");
  });

  it("renders cover slots for stories with and without cover images", () => {
    render(<PackOverview packs={[
      {
        id: "mist-sect",
        title: "雾隐宗",
        subtitle: "xianxia",
        introduction: "山门之外雾气未散。",
        version: "0.2.0",
        assets: { coverImage: "generated/covers/mist-sect.webp" }
      },
      {
        id: "rain-tower",
        title: "雨塔谜案",
        subtitle: "detective",
        introduction: "暴雨夜，旧塔下传来钟声。",
        version: "0.2.0"
      }
    ]} />);

    expect(document.querySelectorAll(".story-card__cover")).toHaveLength(2);
    expect(document.querySelector("[data-has-cover='true']")).toBeTruthy();
    expect(document.querySelector("[data-has-cover='false']")).toBeTruthy();
  });

  it("renders a featured story region and upgraded card hooks", () => {
    render(<PackOverview packs={[
      {
        id: "campus-lunch",
        title: "午餐误会",
        subtitle: "campus",
        introduction: "午休铃声响起，错放的便当让两个人都停下了脚步。",
        version: "0.2.0",
        assets: { coverImage: "generated/covers/campus.webp" }
      },
      {
        id: "rain-tower",
        title: "雨塔谜案",
        subtitle: "detective",
        introduction: "暴雨夜，旧塔下传来钟声。",
        version: "0.2.0"
      }
    ]} />);

    expect(screen.getByRole("region", { name: "精选故事" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "进入 午餐误会" })).toBeTruthy();
    expect(document.querySelector("[data-testid='library-hero-icon']")).toBeTruthy();
    expect(document.querySelectorAll("[data-testid='story-card']")).toHaveLength(2);
  });
});

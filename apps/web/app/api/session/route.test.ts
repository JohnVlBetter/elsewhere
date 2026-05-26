import { randomUUID } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalDbPath = process.env.AIGAME_DB_PATH;

describe("POST /api/session", () => {
  afterEach(() => {
    if (originalDbPath === undefined) {
      delete process.env.AIGAME_DB_PATH;
    } else {
      process.env.AIGAME_DB_PATH = originalDbPath;
    }
    vi.resetModules();
  });

  it("returns profile metadata, pack entities, and generic state", async () => {
    vi.resetModules();
    process.env.AIGAME_DB_PATH = `.tmp/session-route-${randomUUID()}.db`;

    const { POST } = await import("./route");
    const response = await POST();
    const body = await response.json();

    expect(body.packId).toBe("rain-tower");
    expect(body.manifest.profileId).toBe("detective");
    expect(body.profile.id).toBe("detective");
    expect(body.entities.characters).toEqual(expect.arrayContaining([expect.objectContaining({ id: "butler" })]));
    expect(body.entities.facts).toEqual(expect.arrayContaining([expect.objectContaining({ id: "broken_watch" })]));
    expect(body.entities.objectives).toEqual(expect.arrayContaining([expect.objectContaining({ id: "solve_murder" })]));
    expect(body.state.knownFacts).toEqual([]);
    expect(body.state.objectiveStages).toEqual({ solve_murder: "investigate" });
    expect(body.intro).toContain(body.manifest.name);
  });
});

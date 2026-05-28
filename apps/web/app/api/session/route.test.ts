import { randomUUID } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalSessionRoot = process.env.AIGAME_SESSION_ROOT;

describe("POST /api/session", () => {
  afterEach(() => {
    if (originalSessionRoot === undefined) {
      delete process.env.AIGAME_SESSION_ROOT;
    } else {
      process.env.AIGAME_SESSION_ROOT = originalSessionRoot;
    }
    vi.resetModules();
  });

  it("creates a selected pack session and returns generic state", async () => {
    vi.resetModules();
    process.env.AIGAME_SESSION_ROOT = mkdtempSync(join(tmpdir(), `session-route-${randomUUID()}-`));

    const { POST } = await import("./route");
    const response = await POST(new Request("http://test.local/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packId: "rain-tower" })
    }));
    const body = await response.json();

    expect(body.packId).toBe("rain-tower");
    expect(body.manifest.profileId).toBe("detective");
    expect(body.profile.id).toBe("detective");
    expect(body.profile.theme).toBeDefined();
    expect(body.entities.locations[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
    expect(body.entities.characters[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
    expect(body.entities.characters).toEqual(expect.arrayContaining([expect.objectContaining({ id: "butler" })]));
    expect(body.entities.facts).toEqual(expect.arrayContaining([expect.objectContaining({ id: "broken_watch" })]));
    expect(body.entities.objectives).toEqual(expect.arrayContaining([expect.objectContaining({ id: "solve_murder" })]));
    expect(body.state.knownFacts).toEqual([]);
    expect(body.state.objectiveStages).toEqual({ solve_murder: "investigate" });
    expect(body.intro).toContain(body.manifest.name);
    expect(JSON.stringify(body)).not.toContain("鏈");
    expect(JSON.stringify(body)).not.toContain("鐜");
  });
});

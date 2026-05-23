import { describe, expect, it } from "vitest";
import { buildPackIndex, searchPackIndex } from "./packIndex";

describe("pack text index", () => {
  it("returns relevant chunks", () => {
    const index = buildPackIndex([
      { id: "world", text: "The old tower bell rang during the storm." },
      { id: "greenhouse", text: "Mud gathers near the rear door." }
    ]);

    const results = searchPackIndex(index, "mud near door", 2);

    expect(results[0]?.id).toBe("greenhouse");
  });
});

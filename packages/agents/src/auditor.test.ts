import { describe, expect, it } from "vitest";
import { auditOutput } from "./auditor";

describe("auditOutput", () => {
  it("rejects forbidden disclosures", () => {
    const result = auditOutput("He reset the bell after the murder.", {
      forbiddenPhrases: ["reset the bell"],
      requireInWorld: true
    });

    expect(result).toEqual({ ok: false, reason: "Output contains forbidden phrase: reset the bell" });
  });

  it("accepts in-world narration", () => {
    expect(auditOutput("Rain taps against the glass.", { forbiddenPhrases: [], requireInWorld: true })).toEqual({ ok: true });
  });
});

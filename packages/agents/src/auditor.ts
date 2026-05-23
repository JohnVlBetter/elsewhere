export type AuditResult = { ok: true } | { ok: false; reason: string };

export function auditOutput(text: string, policy: { forbiddenPhrases: string[]; requireInWorld: boolean }): AuditResult {
  const lower = text.toLowerCase();

  for (const phrase of policy.forbiddenPhrases) {
    if (lower.includes(phrase.toLowerCase())) {
      return { ok: false, reason: `Output contains forbidden phrase: ${phrase}` };
    }
  }

  if (policy.requireInWorld && /system prompt|developer instruction|json schema/i.test(text)) {
    return { ok: false, reason: "Output mentions runtime instructions" };
  }

  return { ok: true };
}

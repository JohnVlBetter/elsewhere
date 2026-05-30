export interface ActionSegment {
  rawText: string;
}

const ACTION_START = "<ACTION_START>";
const ACTION_END = "<ACTION_END>";

export function planActionSegments(inputText: string): string[] {
  const rawText = inputText.trim();
  if (!rawText) return [];

  const marked = parseMarkedActionSegments(rawText);
  if (marked.length > 0) return marked;

  const segments = rawText
    .split(/\s*(?:\r?\n|;|；|，然后|然后|接着|并且|并|再)\s*/u)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return segments.length > 0 ? segments : [rawText];
}

export function parseMarkedActionSegments(text: string): string[] {
  const segments: string[] = [];
  const pattern = new RegExp(`${escapeRegExp(ACTION_START)}([\\s\\S]*?)${escapeRegExp(ACTION_END)}`, "g");
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    const body = match[1]?.trim();
    if (!body) continue;
    try {
      const parsed = JSON.parse(body) as { rawText?: unknown };
      if (typeof parsed.rawText === "string" && parsed.rawText.trim()) {
        segments.push(parsed.rawText.trim());
      }
    } catch {
      // Ignore malformed planner chunks; callers fall back if nothing valid remains.
    }
  }

  return segments;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

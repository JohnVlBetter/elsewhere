# Action Streaming Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Support natural multi-action player input, stream each completed action over SSE, and render the timeline with clear narrative and state-change hierarchy.

**Architecture:** Keep the deterministic runtime as the authority. Add a small action-planning layer that splits raw input into ordered action segments, execute those segments sequentially through the existing `runTurn`, stop at the first failed/unknown action, and stream each child turn result to the web UI. Expand typed timeline events and frontend rendering so behavior, prose, dialogue, discoveries, state changes, and notices have distinct visual treatment.

**Tech Stack:** TypeScript, Zod, Next.js App Router, React 19, Vitest, Testing Library, Playwright, SSE.

---

## Scope Check

This plan implements one product slice: action-level interaction and rendering. It does not add true token streaming from the model provider, does not let the model apply patches directly, and does not build a full visual-novel staging system. The first implementation supports deterministic splitting plus explicit `<ACTION_START>` / `<ACTION_END>` marker parsing, leaving provider-level streaming as a later adapter detail.

## File Responsibility Map

- `packages/runtime/src/actionPlanner.ts`: splits natural input into ordered action segment strings and parses marked LLM planner output.
- `packages/runtime/src/actionPlanner.test.ts`: proves Chinese compound actions, marked planner output, and fallback behavior.
- `packages/runtime/src/actionParser.ts`: improves natural Chinese parsing for inspection, talking/saying, and movement phrases without command IDs.
- `packages/runtime/src/actionParser.test.ts`: regression coverage for `检查怀表`, `与管家说“你好”`, and `走向书房`.
- `packages/runtime/src/orchestrator.ts`: makes unknown actions return player-facing notice without calling the model; marks scene events with message role metadata.
- `packages/runtime/src/orchestrator.test.ts`: verifies unknown actions do not call the model and Chinese natural actions produce canonical patches.
- `packages/runtime/src/multiTurn.ts`: sequentially runs planned action segments through `runTurn`, exposes callbacks for streaming, and stops at failed/unknown actions.
- `packages/runtime/src/multiTurn.test.ts`: verifies ordered execution, per-action state, and fail-fast behavior.
- `packages/runtime/src/timeline.ts`: emits relationship and resource timeline events from accepted patches, and scene metadata for environment/narration messages.
- `packages/runtime/src/timeline.test.ts`: verifies new event kinds and metadata.
- `packages/runtime/src/index.ts`: exports the new planner and multi-turn runner.
- `packages/shared/src/domain.ts`: extends `TimelineEventSchema` with `relationship` and `resource` event kinds.
- `packages/shared/src/domain.test.ts`: verifies the new event kinds parse.
- `apps/web/src/server/turnService.ts`: adds `runStoredTurnStream` that commits and appends timeline events after each action result.
- `apps/web/app/api/turn/stream/route.ts`: emits action-level SSE events.
- `apps/web/app/api/turn/stream/route.test.ts`: verifies `action:result` is emitted before `turn:done`, and legacy unsafe details stay hidden.
- `apps/web/src/components/turnStream.ts`: parses action-level SSE while retaining final-result compatibility.
- `apps/web/src/components/turnStream.test.ts`: verifies callbacks fire for each streamed action result and errors remain player-safe.
- `apps/web/src/components/GameShell.tsx`: uses streamed action results to append timeline events immediately and update state incrementally.
- `apps/web/src/components/GameShell.test.tsx`: verifies incremental append and retry behavior.
- `apps/web/src/components/packVisuals.ts`: normalizes new event kinds and scene message-role metadata.
- `apps/web/src/components/TimelineEventView.tsx`: renders behavior/prose/dialogue/state/discovery/notice with distinct structure.
- `apps/web/src/components/TimelineEventView.test.tsx`: verifies the new event class hooks and readable hierarchy.
- `apps/web/app/globals.css`: adds typography, spacing, and distinct timeline styles.
- `apps/web/tests/player.spec.ts`: browser check for typed event rendering and no raw runtime/debug copy.

## Task 1: Action Planner and Natural Parser

**Files:**
- Create: `packages/runtime/src/actionPlanner.ts`
- Create: `packages/runtime/src/actionPlanner.test.ts`
- Modify: `packages/runtime/src/actionParser.ts`
- Modify: `packages/runtime/src/actionParser.test.ts`
- Modify: `packages/runtime/src/index.ts`

- [ ] **Step 1: Add failing planner tests**

Create `packages/runtime/src/actionPlanner.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMarkedActionSegments, planActionSegments } from "./actionPlanner";

describe("planActionSegments", () => {
  it("splits common Chinese compound action separators", () => {
    expect(planActionSegments("检查怀表并与管家说“你好”并走向书房")).toEqual([
      "检查怀表",
      "与管家说“你好”",
      "走向书房"
    ]);
  });

  it("keeps text as one action when no separator exists", () => {
    expect(planActionSegments("检查怀表")).toEqual(["检查怀表"]);
  });

  it("parses explicit action markers from constrained planner output", () => {
    expect(parseMarkedActionSegments([
      "<ACTION_START>",
      "{\"rawText\":\"检查怀表\"}",
      "<ACTION_END>",
      "<ACTION_START>",
      "{\"rawText\":\"走向书房\"}",
      "<ACTION_END>"
    ].join("\n"))).toEqual(["检查怀表", "走向书房"]);
  });

  it("drops malformed marked segments and keeps valid ones", () => {
    expect(parseMarkedActionSegments([
      "<ACTION_START>",
      "not json",
      "<ACTION_END>",
      "<ACTION_START>",
      "{\"rawText\":\"询问管家\"}",
      "<ACTION_END>"
    ].join("\n"))).toEqual(["询问管家"]);
  });
});
```

- [ ] **Step 2: Run planner tests and verify RED**

Run: `npm test -- packages/runtime/src/actionPlanner.test.ts`

Expected: FAIL because `packages/runtime/src/actionPlanner.ts` does not exist.

- [ ] **Step 3: Implement the planner**

Create `packages/runtime/src/actionPlanner.ts`:

```ts
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
```

- [ ] **Step 4: Export planner**

Modify `packages/runtime/src/index.ts`:

```ts
export * from "./actionParser";
export * from "./actionPlanner";
export * from "./orchestrator";
export * from "./simulator";
export * from "./timeline";
```

- [ ] **Step 5: Run planner tests and verify GREEN**

Run: `npm test -- packages/runtime/src/actionPlanner.test.ts`

Expected: PASS.

- [ ] **Step 6: Add failing natural parser tests**

Append to `packages/runtime/src/actionParser.test.ts` inside `describe("parseAction", ...)`:

```ts
  it("parses natural Chinese inspection with the item alias itself", () => {
    expect(parseAction("检查怀表", lexicon)).toEqual({
      type: "inspect",
      targetId: "silver_watch",
      rawText: "检查怀表"
    });
  });

  it("parses natural Chinese speech to a visible character", () => {
    expect(parseAction("与管家说“你好”", lexicon)).toEqual({
      type: "talk",
      characterId: "butler",
      topic: "你好",
      rawText: "与管家说“你好”"
    });
  });

  it("parses natural Chinese movement using 走向", () => {
    expect(parseAction("走向书房", lexicon)).toEqual({
      type: "move",
      locationId: "study",
      rawText: "走向书房"
    });
  });
```

- [ ] **Step 7: Run parser tests and verify RED**

Run: `npm test -- packages/runtime/src/actionParser.test.ts`

Expected: at least the `说` and `走向` tests FAIL before implementation.

- [ ] **Step 8: Implement natural parser additions**

Modify `packages/runtime/src/actionParser.ts`:

```ts
  if (hasAny(rawText, ["询问", "问", "追问", "盘问", "请教", "说", "告诉", "打招呼"]) && character) {
    return {
      type: "talk",
      characterId: character.entity.id,
      topic: matchTopic(rawText, character.entity.topics ?? []) ?? inferTopic(rawText, character.matchedText),
      rawText
    };
  }
```

Change the movement phrase list:

```ts
  if (hasAny(rawText, ["前往", "去", "移动到", "进入", "走到", "走向"]) && location) {
    return { type: "move", locationId: location.entity.id, rawText };
  }
```

Change `inferTopic` replacements:

```ts
    .replace(/[，。、"'“”]/g, " ")
    .replace(/询问|追问|盘问|请教|告诉|打招呼|说|问/g, " ")
```

- [ ] **Step 9: Run parser tests and verify GREEN**

Run: `npm test -- packages/runtime/src/actionParser.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit planner and parser**

```bash
git add packages/runtime/src/actionPlanner.ts packages/runtime/src/actionPlanner.test.ts packages/runtime/src/actionParser.ts packages/runtime/src/actionParser.test.ts packages/runtime/src/index.ts
git commit -m "feat: plan natural action segments"
```

## Task 2: Multi-Action Runtime and Fail-Fast Semantics

**Files:**
- Create: `packages/runtime/src/multiTurn.ts`
- Create: `packages/runtime/src/multiTurn.test.ts`
- Modify: `packages/runtime/src/orchestrator.ts`
- Modify: `packages/runtime/src/orchestrator.test.ts`
- Modify: `packages/runtime/src/index.ts`

- [ ] **Step 1: Add failing unknown-action runtime test**

Append to `packages/runtime/src/orchestrator.test.ts`:

```ts
  it("returns a notice for unknown actions without calling the model", async () => {
    const model: ModelProvider = {
      async generateStructured<T>(): Promise<T> {
        throw new Error("model should not be called for unknown actions");
      }
    };

    const result = await runTurn({
      pack,
      state: initialState,
      inputText: "跳舞三小时",
      model
    });

    expect(result.action).toEqual({ type: "unknown", rawText: "跳舞三小时" });
    expect(result.messages).toEqual([{ type: "system", text: "这一行动没有明确落点，请换一种说法。" }]);
    expect(result.timelineEvents.map((event) => event.kind)).toEqual(["player_action", "notice"]);
  });
```

- [ ] **Step 2: Run orchestrator tests and verify RED**

Run: `npm test -- packages/runtime/src/orchestrator.test.ts`

Expected: FAIL because unknown actions currently call the model.

- [ ] **Step 3: Implement unknown-action precheck**

Modify `packages/runtime/src/orchestrator.ts` in `precheckAction` before the final return:

```ts
  if (action.type === "unknown") {
    return { ok: false, reason: "Unknown action" };
  }
```

Modify `localizeRuleReason` before `return reason;`:

```ts
  if (reason === "Unknown action") return "这一行动没有明确落点，请换一种说法。";
```

Modify `formatBlockedAction` to avoid double prefix for unknown:

```ts
function formatBlockedAction(reason: string): string {
  const localized = localizeRuleReason(reason);
  return reason === "Unknown action" ? localized : `行动暂时无法完成：${localized}`;
}
```

- [ ] **Step 4: Run orchestrator tests and verify GREEN**

Run: `npm test -- packages/runtime/src/orchestrator.test.ts`

Expected: PASS.

- [ ] **Step 5: Add failing multi-turn tests**

Create `packages/runtime/src/multiTurn.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "@aigame/agents";
import type { SessionState, WorldPack } from "@aigame/shared";
import { runMultiActionTurn } from "./multiTurn";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower", version: "0.2.0", runtimeVersion: "0.2.0", entryLocationId: "foyer", profileId: "detective" },
  worldText: "Stormy estate.",
  profile: {
    id: "detective",
    labels: { facts: "线索" },
    quickActions: [],
    actions: {}
  },
  rules: { allowedPatchTypes: ["reveal_fact", "move_location"], triggers: [] },
  locations: [
    { id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: ["silver_watch"], visibleCharacters: [] },
    { id: "study", name: "Study", description: "Books.", exits: [], visibleObjects: [], visibleCharacters: [] }
  ],
  characters: [],
  facts: [
    { id: "broken_watch", kind: "fact", name: "Broken Watch", description: "Stopped at 8:47.", discoverableWhen: { location_is: "foyer" }, tags: [] }
  ],
  items: [{ id: "silver_watch", name: "Silver Watch", aliases: ["怀表"], description: "A watch.", revealsFactId: "broken_watch" }],
  resources: [],
  relationships: [],
  objectives: [],
  endings: []
};

const initialState: SessionState = {
  currentLocationId: "foyer",
  turn: 0,
  inventory: [],
  knownFacts: [],
  resources: {},
  relationships: {},
  flags: {},
  objectiveStages: {}
};

describe("runMultiActionTurn", () => {
  it("executes planned actions in order and carries state forward", async () => {
    const result = await runMultiActionTurn({
      pack,
      state: initialState,
      inputText: "检查怀表并走向书房",
      model: new FakeModelProvider({ narration: "继续。", spokenBy: [], proposedPatches: [], privateNotes: "test" })
    });

    expect(result.actionResults.map((turn) => turn.action.type)).toEqual(["inspect", "move"]);
    expect(result.state.knownFacts).toEqual(["broken_watch"]);
    expect(result.state.currentLocationId).toBe("study");
    expect(result.stoppedAt).toBeUndefined();
  });

  it("stops at the first failed action and skips later actions", async () => {
    const result = await runMultiActionTurn({
      pack,
      state: initialState,
      inputText: "走向地下室并走向书房",
      model: new FakeModelProvider()
    });

    expect(result.actionResults).toHaveLength(1);
    expect(result.actionResults[0]?.action).toMatchObject({ type: "move", locationId: "地下室" });
    expect(result.state.currentLocationId).toBe("foyer");
    expect(result.stoppedAt).toMatchObject({ actionIndex: 0, inputText: "走向地下室" });
  });

  it("notifies callbacks for each action result", async () => {
    const events: string[] = [];

    await runMultiActionTurn({
      pack,
      state: initialState,
      inputText: "检查怀表并走向书房",
      model: new FakeModelProvider(),
      onActionStart: (event) => events.push(`start:${event.inputText}`),
      onActionResult: (event) => events.push(`result:${event.inputText}`)
    });

    expect(events).toEqual([
      "start:检查怀表",
      "result:检查怀表",
      "start:走向书房",
      "result:走向书房"
    ]);
  });
});
```

- [ ] **Step 6: Run multi-turn tests and verify RED**

Run: `npm test -- packages/runtime/src/multiTurn.test.ts`

Expected: FAIL because `multiTurn.ts` does not exist.

- [ ] **Step 7: Implement multi-turn runner**

Create `packages/runtime/src/multiTurn.ts`:

```ts
import type { ModelProvider } from "@aigame/agents";
import type { SessionState, WorldPack } from "@aigame/shared";
import { planActionSegments } from "./actionPlanner";
import { runTurn } from "./orchestrator";
import type { TurnResult } from "./orchestrator";

export interface MultiActionTurnEvent {
  actionIndex: number;
  inputText: string;
}

export interface MultiActionTurnResult {
  actionResults: TurnResult[];
  state: SessionState;
  stoppedAt?: MultiActionTurnEvent & { reason: string };
}

export async function runMultiActionTurn(input: {
  pack: WorldPack;
  state: SessionState;
  inputText: string;
  model?: ModelProvider;
  modelName?: string;
  signal?: AbortSignal;
  onActionStart?: (event: MultiActionTurnEvent) => void;
  onActionResult?: (event: MultiActionTurnEvent & { result: TurnResult }) => void;
}): Promise<MultiActionTurnResult> {
  const segments = planActionSegments(input.inputText);
  const actionResults: TurnResult[] = [];
  let state = input.state;

  for (const [actionIndex, inputText] of segments.entries()) {
    input.onActionStart?.({ actionIndex, inputText });
    const result = await runTurn({
      pack: input.pack,
      state,
      inputText,
      model: input.model,
      modelName: input.modelName,
      signal: input.signal
    });

    actionResults.push(result);
    state = result.state;
    input.onActionResult?.({ actionIndex, inputText, result });

    if (isFailedActionResult(result)) {
      return {
        actionResults,
        state,
        stoppedAt: {
          actionIndex,
          inputText,
          reason: failureReason(result)
        }
      };
    }
  }

  return { actionResults, state };
}

function isFailedActionResult(result: TurnResult): boolean {
  return result.action.type === "unknown" || isFailedPrecheck(result.trace.precheck);
}

function isFailedPrecheck(value: unknown): boolean {
  return Boolean(value) && typeof value === "object" && "ok" in value && (value as { ok?: unknown }).ok === false;
}

function failureReason(result: TurnResult): string {
  const precheck = result.trace.precheck;
  if (isRecord(precheck) && typeof precheck.reason === "string") return precheck.reason;
  return result.outputText || "Action failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
```

- [ ] **Step 8: Export multi-turn runner**

Modify `packages/runtime/src/index.ts`:

```ts
export * from "./actionParser";
export * from "./actionPlanner";
export * from "./multiTurn";
export * from "./orchestrator";
export * from "./simulator";
export * from "./timeline";
```

- [ ] **Step 9: Run multi-turn tests and verify GREEN**

Run: `npm test -- packages/runtime/src/multiTurn.test.ts packages/runtime/src/orchestrator.test.ts`

Expected: PASS.

- [ ] **Step 10: Commit multi-turn runtime**

```bash
git add packages/runtime/src/multiTurn.ts packages/runtime/src/multiTurn.test.ts packages/runtime/src/orchestrator.ts packages/runtime/src/orchestrator.test.ts packages/runtime/src/index.ts
git commit -m "feat: execute multi-action turns"
```

## Task 3: Timeline Event Types for Narrative Roles and State Changes

**Files:**
- Modify: `packages/shared/src/domain.ts`
- Modify: `packages/shared/src/domain.test.ts`
- Modify: `packages/runtime/src/timeline.ts`
- Modify: `packages/runtime/src/timeline.test.ts`

- [ ] **Step 1: Add failing schema tests for new timeline kinds**

Append to `packages/shared/src/domain.test.ts`:

```ts
  it("parses resource and relationship timeline events", () => {
    expect(TimelineEventSchema.parse({
      id: "evt_resource",
      kind: "resource",
      text: "勇气 +1",
      timestamp: "2026-05-30T12:00:00.000Z",
      refId: "courage",
      visibleToPlayer: true
    }).kind).toBe("resource");

    expect(TimelineEventSchema.parse({
      id: "evt_relationship",
      kind: "relationship",
      text: "管家维尔关系 +1",
      timestamp: "2026-05-30T12:00:00.000Z",
      refId: "butler",
      visibleToPlayer: true
    }).kind).toBe("relationship");
  });
```

- [ ] **Step 2: Run domain tests and verify RED**

Run: `npm test -- packages/shared/src/domain.test.ts`

Expected: FAIL because `resource` and `relationship` are not accepted event kinds.

- [ ] **Step 3: Extend timeline schema**

Modify the enum member in `TimelineEventSchema` in `packages/shared/src/domain.ts`:

```ts
kind: z.enum(["evidence", "item", "progress", "location_change", "relationship", "resource", "notice"]),
```

- [ ] **Step 4: Run domain tests and verify GREEN**

Run: `npm test -- packages/shared/src/domain.test.ts`

Expected: PASS.

- [ ] **Step 5: Add failing timeline tests**

Append to `packages/runtime/src/timeline.test.ts`:

```ts
  it("marks scene events with their source message type", () => {
    const events = buildTimelineEvents({
      command: "look",
      timestamp: "2026-05-30T12:00:00.000Z",
      messages: [
        { type: "environment", text: "雨水沿着门厅地砖流动。" },
        { type: "narration", text: "这一发现让时间线微微错位。" }
      ],
      patches: []
    });

    expect(events.slice(1).map((event) => event.metadata)).toEqual([
      { messageType: "environment" },
      { messageType: "narration" }
    ]);
  });

  it("creates resource and relationship events from accepted patches", () => {
    const events = buildTimelineEvents({
      command: "鼓励林同学",
      timestamp: "2026-05-30T12:00:00.000Z",
      messages: [],
      patches: [
        { type: "adjust_relationship", characterId: "lin", delta: 2, reason: "Encouraged Lin." },
        { type: "adjust_resource", resourceId: "courage", delta: 1, reason: "Gained courage." },
        { type: "set_resource", resourceId: "focus", value: 3, reason: "Focused." }
      ],
      pack: {
        manifest: { id: "p", name: "P", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "room", profileId: "test" },
        worldText: "",
        profile: { id: "test", labels: {}, quickActions: [], actions: {} },
        rules: { allowedPatchTypes: ["adjust_relationship", "adjust_resource", "set_resource"], triggers: [] },
        locations: [{ id: "room", name: "Room", description: "", exits: [], visibleObjects: [], visibleCharacters: [] }],
        characters: [{ id: "lin", name: "林同学", publicDescription: "", privateFacts: [], knows: [], forbiddenDisclosures: [], topics: [] }],
        facts: [],
        items: [],
        resources: [
          { id: "courage", name: "勇气", initial: 0, min: 0, max: 5 },
          { id: "focus", name: "专注", initial: 0, min: 0, max: 5 }
        ],
        relationships: [{ characterId: "lin", name: "林同学好感", initial: 0, min: -5, max: 10 }],
        objectives: [],
        endings: []
      }
    });

    expect(events.map((event) => event.kind)).toEqual(["player_action", "relationship", "resource", "resource"]);
    expect(events[1]?.text).toBe("林同学好感 +2");
    expect(events[2]?.text).toBe("勇气 +1");
    expect(events[3]?.text).toBe("专注 = 3");
  });
```

- [ ] **Step 6: Run timeline tests and verify RED**

Run: `npm test -- packages/runtime/src/timeline.test.ts`

Expected: FAIL because metadata and new patch events are missing.

- [ ] **Step 7: Implement timeline metadata and patch events**

Modify `messageToTimelineEvent` in `packages/runtime/src/timeline.ts`:

```ts
  if (message.type === "environment" || message.type === "narration") {
    return {
      id: randomUUID(),
      kind: "scene",
      text: message.text,
      timestamp,
      visibleToPlayer: true,
      metadata: { messageType: message.type }
    };
  }
```

Add to `patchToTimelineEvent`:

```ts
  if (patch.type === "adjust_relationship") {
    const relationshipName = pack?.relationships.find((relationship) => relationship.characterId === patch.characterId)?.name ?? patch.characterId;
    return {
      id: randomUUID(),
      kind: "relationship",
      refId: patch.characterId,
      text: `${relationshipName} ${formatSignedDelta(patch.delta)}`,
      timestamp,
      visibleToPlayer: true
    };
  }

  if (patch.type === "adjust_resource") {
    const resourceName = pack?.resources.find((resource) => resource.id === patch.resourceId)?.name ?? patch.resourceId;
    return {
      id: randomUUID(),
      kind: "resource",
      refId: patch.resourceId,
      text: `${resourceName} ${formatSignedDelta(patch.delta)}`,
      timestamp,
      visibleToPlayer: true
    };
  }

  if (patch.type === "set_resource") {
    const resourceName = pack?.resources.find((resource) => resource.id === patch.resourceId)?.name ?? patch.resourceId;
    return {
      id: randomUUID(),
      kind: "resource",
      refId: patch.resourceId,
      text: `${resourceName} = ${patch.value}`,
      timestamp,
      visibleToPlayer: true
    };
  }
```

Add helper:

```ts
function formatSignedDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : String(delta);
}
```

- [ ] **Step 8: Run timeline tests and verify GREEN**

Run: `npm test -- packages/shared/src/domain.test.ts packages/runtime/src/timeline.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit timeline event model**

```bash
git add packages/shared/src/domain.ts packages/shared/src/domain.test.ts packages/runtime/src/timeline.ts packages/runtime/src/timeline.test.ts
git commit -m "feat: add state change timeline events"
```

## Task 4: Action-Level SSE Server

**Files:**
- Modify: `apps/web/src/server/turnService.ts`
- Modify: `apps/web/app/api/turn/stream/route.ts`
- Modify: `apps/web/app/api/turn/stream/route.test.ts`

- [ ] **Step 1: Add failing route test for action events**

Append to `apps/web/app/api/turn/stream/route.test.ts`:

```ts
  it("streams each action result before the final turn completion event", async () => {
    vi.resetModules();
    process.env.AIGAME_SESSION_ROOT = mkdtempSync(join(tmpdir(), `stream-route-${randomUUID()}-`));
    process.env.AIGAME_MODEL_PROVIDER = "fake";

    const { POST: createSession } = await import("../../session/route");
    const sessionResponse = await createSession(new Request("http://test.local/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packId: "rain-tower" })
    }));
    const sessionBody = await sessionResponse.json() as { sessionId: string };

    const { POST } = await import("./route");
    const response = await POST(new Request("http://test.local/api/turn/stream", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId: sessionBody.sessionId, inputText: "检查怀表并走向书房" })
    }) as Parameters<typeof POST>[0]);
    const text = await response.text();

    expect(text).toContain("event: turn:start");
    expect(text).toContain("event: action:start");
    expect(text).toContain("event: action:result");
    expect(text).toContain("event: turn:done");
    expect(text.indexOf("event: action:result")).toBeLessThan(text.indexOf("event: turn:done"));
  });
```

- [ ] **Step 2: Run route test and verify RED**

Run: `npm test -- apps/web/app/api/turn/stream/route.test.ts`

Expected: FAIL because the route still emits only `status` and `result`.

- [ ] **Step 3: Add streaming turn service**

Modify imports in `apps/web/src/server/turnService.ts`:

```ts
import { runMultiActionTurn } from "@aigame/runtime";
```

Add types:

```ts
export type StoredTurnStreamEvent =
  | { type: "action:start"; actionIndex: number; inputText: string }
  | { type: "action:result"; actionIndex: number; inputText: string; result: Awaited<ReturnType<typeof runStoredTurn>> };
```

Add function:

```ts
export async function runStoredTurnStream(
  body: TurnRequestBody,
  onEvent: (event: StoredTurnStreamEvent) => void,
  onStatus?: (message: string) => void,
  signal?: AbortSignal
) {
  return withSessionTurnLock(body.sessionId, () => runStoredTurnStreamUnlocked(body, onEvent, onStatus, signal));
}
```

Add unlocked implementation:

```ts
async function runStoredTurnStreamUnlocked(
  body: TurnRequestBody,
  onEvent: (event: StoredTurnStreamEvent) => void,
  onStatus?: (message: string) => void,
  signal?: AbortSignal
) {
  throwIfAborted(signal);
  const session = await sessionStore.getSession(body.sessionId);
  if (!session) throw new TurnRequestError("Session not found", 404);
  const pack = loadPackById(session.packId);
  const runtimeModel = createRuntimeModelConfig();
  onStatus?.("文字正在延展");

  const aggregate = await runMultiActionTurn({
    pack,
    state: session.state,
    inputText: body.inputText,
    model: runtimeModel.model,
    modelName: runtimeModel.modelName,
    signal,
    onActionStart: ({ actionIndex, inputText }) => {
      onEvent({ type: "action:start", actionIndex, inputText });
    },
    onActionResult: ({ actionIndex, inputText, result }) => {
      const playerResult = toStoredPlayerResult(result);
      onEvent({ type: "action:result", actionIndex, inputText, result: playerResult });
    }
  });

  throwIfAborted(signal);
  for (const result of aggregate.actionResults) {
    await sessionStore.updateSessionState(body.sessionId, result.state);
    await sessionStore.appendTimelineEvents(body.sessionId, result.timelineEvents);
  }

  onStatus?.("故事已记录");

  return {
    ...aggregate,
    state: aggregate.state
  };
}
```

Add helper near `formatTurnFailure`:

```ts
function toStoredPlayerResult(result: Awaited<ReturnType<typeof runStoredTurn>>) {
  return result;
}
```

If TypeScript complains about the helper type, replace `StoredTurnStreamEvent` with a local `TurnResult` import from `@aigame/runtime` and use that directly.

- [ ] **Step 4: Update stream route to emit action events**

Modify `apps/web/app/api/turn/stream/route.ts` imports:

```ts
import { formatTurnFailure, parseTurnRequestBody, runStoredTurnStream, TurnRequestError } from "../../../../src/server/turnService";
```

Replace the current `try` body in the stream:

```ts
        send("turn:start", { inputText: body.inputText });
        const result = await runStoredTurnStream(
          body,
          (event) => {
            if (event.type === "action:start") {
              send("action:start", { actionIndex: event.actionIndex, inputText: event.inputText });
            } else {
              send("action:result", {
                actionIndex: event.actionIndex,
                inputText: event.inputText,
                result: toPlayerTurnResult(event.result)
              });
            }
          },
          (message) => send("status", { message }),
          request.signal
        );
        send("turn:done", {
          state: result.state,
          stoppedAt: result.stoppedAt,
          actionCount: result.actionResults.length
        });
        send("result", toPlayerTurnResult(result.actionResults.at(-1) ?? {
          outputText: "",
          timelineEvents: [],
          state: result.state,
          acceptedPatches: [],
          rejectedPatches: [],
          trace: {}
        }));
```

Use a small local helper if the fallback object needs a full `TurnResult` shape in TypeScript.

- [ ] **Step 5: Run route tests and fix typing until GREEN**

Run: `npm test -- apps/web/app/api/turn/stream/route.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit action-level SSE server**

```bash
git add apps/web/src/server/turnService.ts apps/web/app/api/turn/stream/route.ts apps/web/app/api/turn/stream/route.test.ts
git commit -m "feat: stream action results over sse"
```

## Task 5: Stream Client and Incremental GameShell Updates

**Files:**
- Modify: `apps/web/src/components/turnStream.ts`
- Modify: `apps/web/src/components/turnStream.test.ts`
- Modify: `apps/web/src/components/GameShell.tsx`
- Modify: `apps/web/src/components/GameShell.test.tsx`

- [ ] **Step 1: Add failing stream client test**

Append to `apps/web/src/components/turnStream.test.ts`:

```ts
  it("calls action result callbacks before returning turn done", async () => {
    const actionResults: string[] = [];
    const response = streamResponse([
      "event: turn:start\ndata: {\"inputText\":\"检查怀表并走向书房\"}\n\n",
      "event: action:start\ndata: {\"actionIndex\":0,\"inputText\":\"检查怀表\"}\n\n",
      "event: action:result\ndata: {\"actionIndex\":0,\"inputText\":\"检查怀表\",\"result\":{\"outputText\":\"发现怀表。\",\"timelineEvents\":[],\"state\":{\"currentLocationId\":\"foyer\",\"turn\":1,\"inventory\":[],\"knownFacts\":[\"broken_watch\"],\"resources\":{},\"relationships\":{},\"flags\":{},\"objectiveStages\":{}},\"acceptedPatches\":[],\"rejectedPatches\":[],\"trace\":{}}}\n\n",
      "event: turn:done\ndata: {\"state\":{\"currentLocationId\":\"foyer\",\"turn\":1,\"inventory\":[],\"knownFacts\":[\"broken_watch\"],\"resources\":{},\"relationships\":{},\"flags\":{},\"objectiveStages\":{}},\"actionCount\":1}\n\n"
    ]);

    const result = await readTurnEventStream<{ state: { turn: number } }>(response, {
      onActionResult: (event) => actionResults.push(event.inputText)
    });

    expect(actionResults).toEqual(["检查怀表"]);
    expect(result.state.turn).toBe(1);
  });
```

- [ ] **Step 2: Run stream tests and verify RED**

Run: `npm test -- apps/web/src/components/turnStream.test.ts`

Expected: FAIL because `onActionResult` is not supported.

- [ ] **Step 3: Extend stream client options**

Modify `apps/web/src/components/turnStream.ts` signature:

```ts
export async function readTurnEventStream<T>(
  response: Response,
  options: {
    onStatus?: (message: string) => void;
    onActionStart?: (event: { actionIndex: number; inputText: string }) => void;
    onActionResult?: (event: { actionIndex: number; inputText: string; result: T }) => void;
    onActionError?: (event: { actionIndex?: number; inputText?: string; message: string }) => void;
  }
): Promise<T> {
```

Inside the SSE event switch, add before `result` handling:

```ts
      } else if (event.name === "action:start") {
        options.onActionStart?.(JSON.parse(event.data) as { actionIndex: number; inputText: string });
      } else if (event.name === "action:result") {
        const body = JSON.parse(event.data) as { actionIndex: number; inputText: string; result: T };
        options.onActionResult?.(body);
      } else if (event.name === "action:error") {
        const body = JSON.parse(event.data) as { actionIndex?: number; inputText?: string; message?: string };
        const message = playerSafeError(body.message ?? "行动处理失败。");
        options.onActionError?.({ ...body, message });
        throw new Error(message);
      } else if (event.name === "turn:done") {
        return JSON.parse(event.data) as T;
```

Keep legacy `result` support after `turn:done`.

- [ ] **Step 4: Run stream tests and verify GREEN**

Run: `npm test -- apps/web/src/components/turnStream.test.ts`

Expected: PASS.

- [ ] **Step 5: Add GameShell incremental append test**

Append to `apps/web/src/components/GameShell.test.tsx` or update an existing submit test with a mocked stream containing `action:result` before `turn:done`. Use this response body:

```ts
body: [
  "event: action:result",
  `data: ${JSON.stringify({
    actionIndex: 0,
    inputText: "检查怀表",
    result: {
      outputText: "破损怀表。",
      timelineEvents: [
        { id: "evt_action", kind: "player_action", actorId: "player", text: "检查怀表", timestamp: "2026-05-30T12:00:00.000Z", visibleToPlayer: true },
        { id: "evt_evidence", kind: "evidence", refId: "broken_watch", text: "银质怀表停在 8:47。", timestamp: "2026-05-30T12:00:00.000Z", visibleToPlayer: true }
      ],
      state: { currentLocationId: "foyer", turn: 1, inventory: [], knownFacts: ["broken_watch"], resources: {}, relationships: {}, flags: {}, objectiveStages: {} },
      acceptedPatches: [],
      rejectedPatches: [],
      trace: {}
    }
  })}`,
  "",
  "event: turn:done",
  `data: ${JSON.stringify({
    state: { currentLocationId: "foyer", turn: 1, inventory: [], knownFacts: ["broken_watch"], resources: {}, relationships: {}, flags: {}, objectiveStages: {} },
    actionCount: 1
  })}`,
  ""
].join("\n")
```

Assert:

```ts
expect(await screen.findByText("银质怀表停在 8:47。")).toBeTruthy();
expect(screen.getByText("1")).toBeTruthy();
```

- [ ] **Step 6: Run GameShell tests and verify RED**

Run: `npm test -- apps/web/src/components/GameShell.test.tsx`

Expected: FAIL before `GameShell` handles `onActionResult`.

- [ ] **Step 7: Update GameShell streaming reducer**

Modify the call to `readTurnEventStream<TurnResponse>` in `apps/web/src/components/GameShell.tsx`:

```ts
      const body = await readTurnEventStream<TurnResponse>(response, {
        onStatus: (message) => setStatus(message),
        onActionStart: (event) => setStatus(`正在执行：${event.inputText}`),
        onActionResult: (event) => {
          setState(event.result.state);
          setTrace(event.result.trace);
          setEvents((current) => [
            ...current,
            ...visibleTimelineEvents(event.result, event.inputText)
          ]);
        },
        onActionError: (event) => {
          setEvents((current) => [...current, createLocalNoticeEvent(event.message)]);
        }
      });
```

After the await, avoid appending duplicate final events when action results were already streamed:

```ts
      setState(body.state);
      setTrace(body.trace);
      if (body.timelineEvents?.length) {
        setEvents((current) => [
          ...current,
          ...visibleTimelineEvents(body, command)
        ]);
      }
```

If `turn:done` lacks `trace`, keep existing trace.

- [ ] **Step 8: Run focused frontend tests and verify GREEN**

Run:

```bash
npm test -- apps/web/src/components/turnStream.test.ts apps/web/src/components/GameShell.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit stream client**

```bash
git add apps/web/src/components/turnStream.ts apps/web/src/components/turnStream.test.ts apps/web/src/components/GameShell.tsx apps/web/src/components/GameShell.test.tsx
git commit -m "feat: append streamed action results"
```

## Task 6: Timeline Rendering and Typography

**Files:**
- Modify: `apps/web/src/components/packVisuals.ts`
- Modify: `apps/web/src/components/TimelineEventView.tsx`
- Modify: `apps/web/src/components/TimelineEventView.test.tsx`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/tests/player.spec.ts`

- [ ] **Step 1: Add failing TimelineEventView tests**

Append to `apps/web/src/components/TimelineEventView.test.tsx`:

```tsx
  it("renders environment and narration scene roles with distinct hooks", () => {
    render(<>
      <TimelineEventView entityMaps={maps} event={{
        id: "evt_env",
        kind: "scene",
        text: "雨水沿着地砖流动。",
        timestamp: "2026-05-30T12:00:00.000Z",
        visibleToPlayer: true,
        metadata: { messageType: "environment" }
      }} />
      <TimelineEventView entityMaps={maps} event={{
        id: "evt_narration",
        kind: "scene",
        text: "时间线在这里发生了偏移。",
        timestamp: "2026-05-30T12:00:00.000Z",
        visibleToPlayer: true,
        metadata: { messageType: "narration" }
      }} />
    </>);

    expect(document.querySelector("[data-event-role='environment']")).toBeTruthy();
    expect(document.querySelector("[data-event-role='narration']")).toBeTruthy();
  });

  it("renders resource and relationship events with state-change hooks", () => {
    render(<>
      <TimelineEventView entityMaps={maps} event={{
        id: "evt_resource",
        kind: "resource",
        text: "勇气 +1",
        timestamp: "2026-05-30T12:00:00.000Z",
        visibleToPlayer: true
      }} />
      <TimelineEventView entityMaps={maps} event={{
        id: "evt_relationship",
        kind: "relationship",
        text: "林同学好感 +2",
        timestamp: "2026-05-30T12:00:00.000Z",
        visibleToPlayer: true
      }} />
    </>);

    expect(document.querySelector("[data-event-kind='resource']")).toBeTruthy();
    expect(document.querySelector("[data-event-kind='relationship']")).toBeTruthy();
  });
```

- [ ] **Step 2: Run TimelineEventView tests and verify RED**

Run: `npm test -- apps/web/src/components/TimelineEventView.test.tsx`

Expected: FAIL because scene role hooks and new icons/classes are missing.

- [ ] **Step 3: Normalize scene roles and new event kinds**

Modify `TimelineEventViewModel` in `apps/web/src/components/packVisuals.ts`:

```ts
  role?: string;
```

Modify `normalizeTimelineEvent` base:

```ts
  const base = {
    id: event.id,
    kind: event.kind,
    text: event.text,
    role: typeof event.metadata?.messageType === "string" ? event.metadata.messageType : undefined
  };
```

Add handling:

```ts
  if (event.kind === "relationship") {
    return { ...base, title: "关系变化", refId: "refId" in event ? event.refId : undefined };
  }

  if (event.kind === "resource") {
    return { ...base, title: "状态变化", refId: "refId" in event ? event.refId : undefined };
  }
```

- [ ] **Step 4: Update timeline event rendering**

Modify imports in `apps/web/src/components/TimelineEventView.tsx`:

```ts
import { CircleAlert, Gem, Handshake, MapPin, MessageCircle, Package, Search, Target } from "lucide-react";
```

Add icons:

```ts
  relationship: Handshake,
  resource: Gem,
```

Modify scene article:

```tsx
      <article
        className={`timeline-event timeline-event--scene timeline-event--${view.role ?? "narration"} max-w-3xl px-1 py-2 text-[1.04rem] leading-8 text-[var(--ink)]`}
        data-event-kind={view.kind}
        data-event-role={view.role ?? "narration"}
      >
```

Modify generic event article class so `relationship` and `resource` get the same compact state row structure:

```tsx
    <article className={`timeline-event timeline-event--${view.kind} grid max-w-3xl grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-lg border border-[var(--line)] bg-white p-3 shadow-[0_10px_26px_rgba(39,34,28,0.06)]`} data-event-kind={view.kind}>
```

- [ ] **Step 5: Run TimelineEventView tests and verify GREEN**

Run: `npm test -- apps/web/src/components/TimelineEventView.test.tsx`

Expected: PASS.

- [ ] **Step 6: Update CSS typography and event hierarchy**

Modify `apps/web/app/globals.css` by appending:

```css
@layer components {
  .timeline {
    font-size: 15px;
  }

  .timeline-event--scene {
    max-width: 760px;
    background: transparent;
    border: 0;
    box-shadow: none;
  }

  .timeline-event--environment p {
    color: var(--muted);
    font-size: 0.96rem;
    line-height: 1.85;
  }

  .timeline-event--narration p {
    color: var(--ink);
    font-size: 1.04rem;
    line-height: 1.95;
  }

  .timeline-event--dialogue {
    font-size: 0.98rem;
  }

  .timeline-event--dialogue strong,
  .timeline-event--evidence strong,
  .timeline-event--item strong,
  .timeline-event--progress strong,
  .timeline-event--relationship strong,
  .timeline-event--resource strong,
  .timeline-event--location_change strong,
  .timeline-event--notice strong {
    font-size: 0.88rem;
  }

  .timeline-event--player_action {
    font-size: 0.93rem;
  }

  .timeline-event--evidence,
  .timeline-event--item {
    border-color: rgba(138, 105, 58, 0.32);
  }

  .timeline-event--relationship {
    border-color: rgba(85, 122, 81, 0.28);
    background: rgba(85, 122, 81, 0.06);
  }

  .timeline-event--resource {
    border-color: rgba(95, 141, 211, 0.28);
    background: rgba(95, 141, 211, 0.07);
  }

  .timeline-event--notice {
    border-color: rgba(169, 75, 67, 0.24);
    background: rgba(169, 75, 67, 0.07);
  }
}
```

- [ ] **Step 7: Add browser event-kind acceptance**

Append to `apps/web/tests/player.spec.ts` in the event-class test:

```ts
await expect(page.locator("[data-event-kind='resource']")).toBeVisible();
await expect(page.locator("[data-event-kind='relationship']")).toBeVisible();
```

Update the mocked streamed payload in that test to include:

```ts
{ id: "evt_4", kind: "resource", text: "专注 +1", timestamp: "2026-05-29T12:00:00.000Z", visibleToPlayer: true },
{ id: "evt_5", kind: "relationship", text: "管家维尔关系 +1", timestamp: "2026-05-29T12:00:00.000Z", visibleToPlayer: true }
```

- [ ] **Step 8: Run focused UI tests**

Run:

```bash
npm test -- apps/web/src/components/TimelineEventView.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit timeline UI**

```bash
git add apps/web/src/components/packVisuals.ts apps/web/src/components/TimelineEventView.tsx apps/web/src/components/TimelineEventView.test.tsx apps/web/app/globals.css apps/web/tests/player.spec.ts
git commit -m "style: clarify timeline event hierarchy"
```

## Task 7: Verification

**Files:**
- Modify only files needed to fix failures.

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`

Expected: exits `0`.

- [ ] **Step 2: Run unit tests**

Run: `npm test`

Expected: exits `0`.

- [ ] **Step 3: Run browser tests**

Run: `npm run e2e`

Expected: exits `0`.

- [ ] **Step 4: Run web build**

Run: `npm run web:build`

Expected: exits `0`.

- [ ] **Step 5: Start app for manual inspection**

Run: `npm run web:start`

Expected: app is available at `http://127.0.0.1:3000`.

- [ ] **Step 6: Manual acceptance checklist**

- [ ] `检查怀表` triggers inspection without requiring `inspect silver_watch`.
- [ ] `检查怀表并与管家说“你好”并走向书房` executes in order.
- [ ] If an intermediate action fails, later actions are not executed.
- [ ] The timeline updates after each completed action, before the whole turn finishes.
- [ ] Player action, environment/narration, dialogue, evidence, item, progress, resource, relationship, location, and notice rows are visually distinguishable.
- [ ] Typography no longer reads as one uniform chat transcript.
- [ ] Normal play does not expose `Runtime`, provider names, trace JSON, or raw model errors.

## Execution Order

1. Task 1: action planner and natural parser.
2. Task 2: multi-action runtime and fail-fast semantics.
3. Task 3: timeline event types for narrative roles and state changes.
4. Task 4: action-level SSE server.
5. Task 5: stream client and incremental GameShell updates.
6. Task 6: timeline rendering and typography.
7. Task 7: verification.

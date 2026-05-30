# Action Streaming Timeline Design

## Goal

Make player input feel like natural interactive fiction instead of a debug command box. A player should be able to type ordinary Chinese such as `检查怀表并与管家说“你好”并走向书房`, and the game should split it into ordered actions, execute them one by one, stream each completed action to the UI, and render the result with clear narrative roles.

## Current Behavior

The runtime parses one `GameAction` per turn. English command IDs such as `inspect silver_watch` work, and Chinese aliases such as `检查怀表` can also work when the entity is visible. The confusing part is that repeated inspections may produce narration without a new `evidence` event, so the UI looks as if the action did not trigger.

The stream route exists, but it only sends status events and one final result. The player still waits for the whole turn before seeing meaningful output.

The timeline has typed events, but the visual hierarchy is weak. Player action, scene prose, dialogue, discoveries, item gains, progress, relationship changes, resource changes, and failure notices need to read differently at a glance.

## Product Requirements

- Accept natural-language player input without requiring command IDs.
- Support multiple actions in one message.
- Execute multiple actions sequentially.
- Stop at the first failed action and do not execute later actions.
- Stream action-level progress through SSE.
- Append a complete action result to the UI as soon as that action finishes.
- Render narrative roles distinctly: behavior, environment feedback, narration, dialogue, evidence, item gain, relationship/resource changes, progress, location movement, and notices.
- Improve typography and spacing so the timeline feels like a polished reader rather than uniform chat bubbles.

## Recommended Architecture

Use a deterministic runtime as the authority, with an optional constrained action planner in front of it.

1. The turn service receives the raw player input.
2. A planner splits the input into ordered action segments.
3. Each segment is parsed through the existing action parser and pack lexicon.
4. Each parsed action runs through the existing precheck, model, rule patch, validation, and timeline flow.
5. If a segment fails precheck or turn execution, the turn emits a notice and stops.
6. State is committed after each successful segment so streamed UI and stored session stay aligned.

The planner may use LLM output, but the LLM must not directly mutate state. It only proposes action segments.

## Planner Contract

The planner returns ordered action segments. For LLM-backed planning, the model output is constrained by explicit markers:

```text
<ACTION_START>
{"rawText":"检查怀表"}
<ACTION_END>
<ACTION_START>
{"rawText":"与管家说“你好”"}
<ACTION_END>
```

The parser ignores malformed segments and falls back to the raw input as a single action if no valid segments are found.

The deterministic splitter handles common separators first: `并`, `然后`, `接着`, `再`, `，然后`, semicolons, and newline-separated commands. LLM planning is the fallback for text that appears compound but is not safely split by rules.

## Runtime Contract

Add a multi-action turn runner, while preserving the existing single-action `runTurn` for compatibility and tests.

The multi-action runner returns:

```ts
type MultiActionTurnResult = {
  actionResults: TurnResult[];
  state: SessionState;
  stoppedAt?: {
    actionIndex: number;
    inputText: string;
    reason: string;
  };
};
```

Each child `TurnResult` keeps its own action, messages, patches, timeline events, trace, and state after that action.

## SSE Contract

Replace the player-facing stream shape with action-level events:

- `turn:start`: raw input accepted.
- `action:start`: one planned action is beginning.
- `action:result`: one action finished; payload includes visible timeline events and state after that action.
- `action:error`: one action failed; payload includes a player-facing notice and state before later actions.
- `turn:done`: final state and aggregate trace summary.

The old `result` event can remain temporarily for compatibility, but the frontend should prefer `action:result` events.

## Timeline Event Model

Keep existing event kinds and add missing state-change kinds:

- `player_action`: player behavior.
- `scene`: narration or environmental prose.
- `dialogue`: character speech.
- `evidence`: discovered fact or clue.
- `item`: gained or lost item.
- `progress`: objective or story progress.
- `location_change`: movement result.
- `relationship`: relationship delta.
- `resource`: numeric resource delta or set.
- `notice`: blocked action, failed action, unclear action, or retryable problem.
- `debug`: hidden from normal play.

Turn messages should distinguish `environment` from `narration` where possible, but both may render as readable prose. Environment feedback should be visually quieter and concrete; narration can be slightly more literary.

## Visual Design

The timeline should have a reading hierarchy:

- Player actions: compact right-aligned strips, smaller and bolder than prose.
- Environment feedback: unboxed prose with a small icon/label and comfortable line height.
- Narration: main prose, larger line height, no heavy card.
- Dialogue: avatar slot, speaker name, quote body, distinct text rhythm.
- Evidence/items/state changes: compact discovery rows with icons, title, and smaller explanatory body.
- Notices: restrained warning rows, not the same style as story prose.

Typography should use stable sizes, not viewport-scaling. Body prose should be easier to read than side panels. Cards stay at 8px radius or below. The palette should use neutral reading surfaces plus restrained accent colors, not a single flat beige/blue block.

## Frontend Flow

`GameShell` owns a streaming reducer:

1. Clear errors and submit input.
2. On `turn:start`, show pending state.
3. On `action:start`, append or mark a pending action row.
4. On `action:result`, append visible events immediately and update state.
5. On `action:error`, append notice, restore failed input if retryable, stop pending state.
6. On `turn:done`, set ready status and final trace.

The frontend should not infer event types from text when typed events are available.

## Error Handling

- Planner failure falls back to one raw action.
- Unknown action returns a `notice` and stops the multi-action turn.
- Precheck failure stops the turn before model calls.
- Model or stream failure keeps the user input and appends a `notice`.
- Debug traces, provider names, and raw model errors stay out of normal play.

## Testing

Add focused tests for:

- Chinese natural-language inspection still resolves to the visible item.
- Compound input is split and executed in order.
- Compound input stops at the first failed action.
- Multi-action state commits after each successful action.
- SSE emits `action:result` before `turn:done`.
- Frontend appends each streamed action result immediately.
- Timeline renders distinct classes for player action, environment, narration, dialogue, evidence, item, progress, relationship, resource, location change, and notice.
- Stream failures keep the typed input.

## Non-Goals

- Do not let the LLM apply patches directly.
- Do not replace pack rules with free-form model decisions.
- Do not build a full visual-novel staging engine.
- Do not require users to learn command IDs.

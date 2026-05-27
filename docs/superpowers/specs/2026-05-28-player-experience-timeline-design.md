# Player Experience Timeline Design

## Context

The current web runtime works as a generic v0.2 story engine, but the player experience still exposes implementation details and loses important story state. The UI has English fallback labels, a stretched header, a visible runtime trace, and a single chat-like message style for environment text, character speech, evidence, items, and failures. Rain Tower also exposes spoilers through names and quick actions, such as "继承人伊莲" and "指认管家".

The latest local session log shows deeper runtime issues:

- Some player inputs parse as `unknown` even when they are natural story commands, such as "查看维护记录", "信件", and "查看温室".
- The model can narrate that evidence was found without producing an accepted `reveal_fact` patch, so the visible story and canonical state diverge.
- "询问众人" has no group-talk action and no location character list, so the system often responds as if nobody is present.
- Follow-up questions like "你8:47在哪" do not remember the previous speaker.
- Any named character can answer from any location because characters are not tied to visible locations.
- Normal play logs are stored in SQLite, which makes quick inspection and replay awkward for local single-player sessions.

## Goal

Build a first version of a structured, replayable, novel-style player timeline. The first version should fix the obvious immersion breaks without turning the project into a full editor, replay studio, or analytics system.

## Non-Goals

- No visual mockup companion.
- No pack editor.
- No timeline filtering beyond hiding debug events by default.
- No multiplayer, user accounts, or hosted database migration.
- No full natural-language planner. The parser remains deterministic plus model narration.
- No free-form scripting language inside packs.

## Scope

This design covers five connected changes:

1. A story overview page that lists all local packs.
2. A play route that starts a session for a selected pack instead of hardcoding Rain Tower.
3. A structured timeline event model and novel-style UI renderer.
4. A JSONL-backed local session log store for ordinary play.
5. Runtime and pack cleanups that keep visible story, canonical state, and player intent aligned.

## Product Behavior

### Story Overview

The root page displays all directories under `packs/*` that contain a valid `manifest.yaml`. Each story card shows:

- story name
- profile/genre
- short world summary from `world.md`
- version
- entry action to start playing

Selecting a story navigates to `/play/<packId>`. The pack ID must resolve to a local pack directory; invalid IDs return a friendly not-found page or API error.

### Game Page

The game page uses the selected pack and no longer assumes Rain Tower. The top area is compact: story title, current location, turn, and current objective stage. The large stretched hero panel is removed.

The main column is the timeline. The composer stays at the bottom. The side panel shows current state in player-facing terms: location, visible exits, known facts, inventory, relationships/resources/objectives when present.

Runtime traces are hidden by default. A development-only debug drawer can show raw action, model name, context IDs, accepted/rejected patches, and private trace. This drawer is not part of the in-world timeline.

### Timeline Rendering

The timeline is not a uniform chat log. It renders event types with distinct components:

- `player_action`: right-aligned compact action strip.
- `scene`: unframed novel paragraph for environment and action results.
- `dialogue`: character speech block with speaker name and visual identity.
- `evidence`: evidence card with fact name and canonical description.
- `item`: item card with item name and canonical description.
- `progress`: objective or major state progress row.
- `location_change`: compact transition row.
- `notice`: narrow in-world feedback for blocked, unclear, or failed actions.
- `debug`: hidden by default, visible only in the debug drawer.

NPC private thoughts must never be shown. Main-character thought or deduction can use a restrained `scene` variant only when it represents the player character's own inference, not omniscient knowledge.

### Waiting State

The waiting state must stay in-world. The UI should not say "calling model" or expose runtime internals. Acceptable pending text examples:

- "屋内短暂安静下来。"
- "众人的目光转向你。"
- "你整理着刚才的发现。"

The composer status can say "处理中" or "等待回应", but the visible timeline should remain diegetic.

## Timeline Event Model

Add a shared `TimelineEvent` type with a stable base shape:

```ts
type TimelineEvent = {
  id: string;
  sessionId: string;
  packId: string;
  turn: number;
  type:
    | "player_action"
    | "scene"
    | "dialogue"
    | "evidence"
    | "item"
    | "progress"
    | "location_change"
    | "notice"
    | "debug";
  text: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
};
```

Expected metadata keys:

- `player_action`: `{ inputText, action }`
- `dialogue`: `{ characterId, speakerName }`
- `evidence`: `{ factId, factName }`
- `item`: `{ itemId, itemName }`
- `progress`: `{ objectiveId, objectiveName, stage }`
- `location_change`: `{ fromLocationId, toLocationId, locationName }`
- `notice`: `{ reason, severity }`
- `debug`: `{ trace, acceptedPatches, rejectedPatches }`

The API may still return `messages` for compatibility during migration, but the web UI should render `timelineEvents` when present.

## JSONL Session Logs

For ordinary local play, session logs should be stored as JSONL instead of SQLite events:

```text
.tmp/sessions/<sessionId>/session.json
.tmp/sessions/<sessionId>/state.json
.tmp/sessions/<sessionId>/events.jsonl
```

`events.jsonl` contains one `TimelineEvent` JSON object per line. It is append-only during a turn. `state.json` stores the latest canonical `SessionState`. `session.json` stores session metadata: session ID, pack ID, pack path, creation time, and last update time.

SQLite can remain available behind an optional store implementation for future indexed search, hosted mode, or compatibility tests. It should not be the default store for local web play.

## Runtime Behavior

### Action Parsing

The deterministic parser should recognize common Chinese story commands through pack aliases:

- `查看门厅`, `环顾四周`, `看看这里` -> `look`
- `查看银怀表`, `检查怀表时间` -> `inspect silver_watch`
- `查看维护记录`, `维护记录`, `钟楼记录` -> `inspect tower_bell_record`
- `信件`, `查看信件` -> `inspect torn_letter`
- `前往温室`, `去书房` -> `move`
- `询问管家 ...`, `问伊莲夫人 ...` -> `talk`
- `询问众人 ...`, `问大家 ...` -> group inquiry
- Follow-up questions without a named character use `lastInterlocutorId` when available.

Unknown actions are still allowed, but they should not produce canonical discoveries. They should produce `notice` or `scene` feedback that guides the player to a clearer action.

### Conversation Focus

Extend `SessionState` with optional conversation focus:

```ts
lastInterlocutorId?: string;
```

When a `talk` action succeeds, set `lastInterlocutorId` to that character. If the next input looks like a question and does not name a character, parse it as a `talk` action to `lastInterlocutorId`. When the player moves, keep the focus only if that character is visible in the new location; otherwise clear it.

### Character Presence

Add visible character references to locations:

```yaml
visibleCharacters:
  - butler
  - gardener
  - heiress
```

The narrator context should include visible characters for the current location. Character talk precheck should block or redirect questions to characters not visible at the current location, unless the pack later defines remote communication.

Group inquiry uses visible characters in the current location. If no characters are visible, it returns a `notice` with an in-world explanation.

### Canonical Discoveries

The runtime must not let the model create player-visible evidence outside accepted patches.

When an accepted `reveal_fact` patch exists, render an `evidence` event using the canonical fact name and description. If the model narration also mentions the fact, the renderer should still prefer the canonical evidence card.

When the action is `unknown`, model narration may describe visible objects but must not claim the player confirmed a fact unless a patch was accepted.

### Progress and Endings

Accepted `set_objective_stage` patches produce `progress` events. Endings produce a `progress` or `notice` event with localized pack text. Rain Tower endings must be Chinese.

## Pack Cleanup

Rain Tower should stop exposing spoilers in public UI:

- Rename `继承人伊莲` to `伊莲夫人`.
- Keep "继承人" as hidden context or alias only if needed for parsing.
- Replace quick action `指认管家` with a neutral action like `提出指控`, and only show it when enough evidence is known.
- Localize ending names and ending text.
- Ensure `locations.yaml` declares visible characters so group questions and presence checks are coherent.

Other packs should get minimal metadata and visible character coverage only where needed for tests.

## API Changes

Add or update endpoints:

- `GET /api/packs`: list valid local packs for the overview page.
- `POST /api/session`: accept `{ packId }` and create a session for that pack.
- `GET /api/session/:sessionId/events`: return JSONL-backed events for replay or refresh.
- `POST /api/turn/stream`: keep streaming status and final result, but final result includes `timelineEvents`.

The stream should send in-world status messages only. Debug details belong in the final debug event and hidden drawer.

## Frontend Architecture

Split the current large `GameShell` into focused components:

- `PackOverview`: renders local pack cards.
- `GameShell`: owns session loading, turn submission, and layout.
- `Timeline`: renders ordered timeline events.
- `TimelineEventView`: dispatches by event type.
- `StateSidebar`: renders player-facing state.
- `ActionComposer`: handles input and quick actions.
- `DebugDrawer`: dev-only trace viewer.

This split keeps timeline rendering testable without requiring a live session.

## Error Handling

- Invalid pack ID: return 404 with a Chinese message.
- Missing session: return 404 and prompt the user to return to story selection.
- Store write failure: keep the turn from being committed and show a `notice`.
- Model failure: show in-world retry feedback and keep the player's input in the composer.
- Malformed model JSON: no state change; show a retry notice.

## Testing

Add unit and integration coverage for:

- pack listing from `packs/*`
- session creation for selected pack ID
- JSONL append/read round trip
- timeline event generation from narration, speech, patches, progress, and blocked actions
- parser cases from the latest log: "查看维护记录", "信件", "查看温室", "询问众人", and follow-up "你8:47在哪"
- conversation focus set/used/cleared
- character presence precheck
- Rain Tower no longer renders "继承人伊莲" as public name
- debug trace hidden from default UI
- Playwright smoke test for overview -> select story -> submit action -> differentiated timeline events

## Acceptance Criteria

- The app opens on a story overview page instead of immediately starting Rain Tower.
- Selecting a story starts that pack and uses its profile labels.
- The main log visually distinguishes player actions, scene text, dialogue, evidence, items, progress, notices, and debug.
- The visible UI does not show "Runtime", "calling model", raw handler names, raw context IDs, or English default labels during normal play.
- Latest-log failure cases are handled deterministically: evidence does not appear without state, follow-up questions target the previous speaker, and group questions use visible characters.
- Normal local session logs can be inspected by opening `events.jsonl`.
- Rain Tower public names and quick actions no longer spoil the culprit or role twist.

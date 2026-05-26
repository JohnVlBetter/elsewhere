# Generic Genre Runtime Design

## Goal

The current MVP started as a general AI interactive world runtime, but the implemented schema, runtime rules, CLI, simulator, and Web UI now treat detective mystery as the default shape of every story. Version 0.2 should intentionally break the old pack schema and move the product back toward a general interactive world engine that supports detective, cultivation, romance, tabletop fantasy, and other story genres.

The key design decision is: core runtime owns universal state and rules; genre profile owns genre vocabulary and UI/action semantics; world pack owns concrete content and progression.

## Non-Goals

- Do not preserve backwards compatibility with the old `clues.yaml`, `knownClues`, `discover_clue`, or `accuse` API.
- Do not implement arbitrary TypeScript genre plugins in v0.2.
- Do not introduce a free-form scripting language or user-executable code in packs.
- Do not redesign the visual style beyond making it profile-driven and non-detective-specific.

## Current Problems

The current code has detective assumptions in multiple layers:

- `WorldPack` requires `clues`, and `SessionState` stores `knownClues`.
- Conditions use `knows_clue`; patches use `discover_clue`.
- Actions include `accuse` as a core action.
- `deriveRulePatches()` contains Rain Tower-specific truth logic, including the butler and required evidence IDs.
- Agent contexts and prompts speak in terms of clues and known clue facts.
- CLI exposes a `clues` command and simulator assertions expect known clues.
- Web UI hardcodes Rain Tower title, quick actions, labels, clue names, NPC names, and case-oriented panels.
- Only one sample pack exists, so tests do not reveal genre coupling.

## Architecture

Use a three-layer design.

### Core Runtime

Core runtime is genre-neutral. It validates packs, parses common actions, applies rule-checked patches, evaluates conditions, advances sessions, judges endings, and builds agent context.

Core runtime must not use detective-specific concepts such as clue, accuse, murder, suspect, case, alibi, or evidence in type names, state names, function names, CLI commands, or UI defaults.

### Genre Profile

A genre profile is pack data, not executable code. It defines how generic concepts should be named, displayed, and parsed for a genre.

Examples:

- detective labels `facts` as clues and enables `confront`.
- cultivation labels resources as spiritual power, realm, and heart demon pressure, and enables `cultivate` and `breakthrough`.
- romance emphasizes relationships, memories, misunderstandings, comfort, invitations, and confession.
- tabletop fantasy labels resources as HP, gold, spell slots, or supplies, and enables skill checks, negotiation, and combat-like intents.

Profiles provide semantic vocabulary without changing core data structures.

### World Pack

A world pack contains concrete world content and rule triggers. The pack decides what an action means in that world.

Rain Tower remains a detective pack, but its clues become generic facts and its accusation flow becomes a `confront` intent handled by pack rules.

## Pack File Structure

Version 0.2 packs should use:

```text
manifest.yaml
world.md
profile.yaml
locations.yaml
characters.yaml
items.yaml
facts.yaml
resources.yaml
objectives.yaml
endings.yaml
rules.yaml
scripts/
```

Changes from v0.1:

- `npcs.yaml` becomes `characters.yaml`.
- `clues.yaml` becomes `facts.yaml`.
- `quests.yaml` becomes `objectives.yaml`.
- `knownClues` becomes `knownFacts`.
- `discover_clue` becomes `reveal_fact`.
- `knows_clue` becomes `knows_fact`.
- `accuse` is removed from core actions.

## Manifest

`manifest.yaml` remains the entry point:

```yaml
id: rain-tower
name: 雨塔谋杀案
version: 0.2.0
runtimeVersion: 0.2.0
entryLocationId: foyer
profileId: detective
```

## Profile Schema

`profile.yaml` defines genre vocabulary and input affordances:

```yaml
id: detective
labels:
  location: 现场
  characters: 相关人物
  facts: 线索
  inventory: 物证
  resources: 状态
  relationships: 关系
  objectives: 案件进展
  ending: 结局
quickActions:
  - label: 环顾门厅
    command: look
  - label: 检查银怀表
    command: inspect silver_watch
  - label: 询问管家
    command: talk butler about alibi
  - label: 指认管家
    command: confront butler with broken_watch muddy_bootprint tower_bell_record
actions:
  confront:
    aliases: [指认, 质询, accuse, confront]
    requiresTarget: character
    acceptsFacts: true
  examine:
    aliases: [检查, 查看, inspect, examine]
    mapsTo: inspect
```

The runtime can ship built-in defaults for common profile IDs, but pack-local `profile.yaml` is the source of truth for labels and quick actions.

## Core Domain Schema

### Characters

Characters replace NPCs:

```yaml
- id: butler
  name: 管家
  aliases: [管家, butler]
  publicDescription: 他衣着整齐，声音压得很低。
  privateFacts:
    - 他重置过钟楼机关。
  knows:
    - false_alibi
  forbiddenDisclosures:
    - 我就是凶手
  topics:
    - id: alibi
      prompt: 询问案发时的不在场证明
      aliases: [不在场证明, alibi]
      unlockCondition:
        knows_fact: broken_watch
      revealsFactId: false_alibi
```

`privateFacts` remains hidden context. `revealsFactId` replaces `revealsClueId`.

### Facts

Facts represent player-confirmed information:

```yaml
- id: broken_watch
  kind: evidence
  name: 破损怀表
  aliases: [怀表, 银怀表, broken watch]
  description: 银质怀表停在 8:47。
  discoverableWhen:
    location_is: foyer
  tags: [timeline]
```

`kind` is profile-defined vocabulary. The core runtime validates IDs and conditions but does not interpret kind values.

Examples by genre:

- detective: `evidence`, `testimony`, `timeline`
- cultivation: `omen`, `technique`, `secret`, `chance`
- romance: `memory`, `rumor`, `preference`, `misunderstanding`
- tabletop fantasy: `lore`, `quest_info`, `tactical_info`

### Resources

Resources are numeric state:

```yaml
- id: spiritual_power
  name: 灵力
  initial: 2
  min: 0
  max: 10
```

Resources support thresholds, increases, decreases, and direct setting through rule-checked patches.

### Relationships

Relationships are numeric per-character state:

```yaml
- characterId: classmate_lin
  name: 林同学好感
  initial: 0
  min: -5
  max: 10
```

Core state stores them as `relationships: Record<string, number>`, keyed by character ID unless a later implementation needs multiple relationship tracks per character.

### Objectives

Objectives replace quests:

```yaml
- id: solve_murder
  name: 查清哈尔登爵士之死
  stages: [investigate, confront, resolved]
  initialStage: investigate
```

Objectives cover investigations, cultivation breakthroughs, romance arcs, dungeon goals, and other progress tracks.

## Session State

`SessionState` should become:

```ts
{
  currentLocationId: string;
  turn: number;
  inventory: string[];
  knownFacts: string[];
  resources: Record<string, number>;
  relationships: Record<string, number>;
  flags: Record<string, boolean>;
  objectiveStages: Record<string, string>;
}
```

Initial state is built from pack entry location, resource definitions, relationship definitions, and objective initial stages.

## Actions

Core actions:

- `look`
- `move`
- `inspect`
- `talk`
- `take`
- `use`
- `act`
- `unknown`

`act` carries genre-specific intent:

```ts
{
  type: "act";
  intent: string;
  targetId?: string;
  itemId?: string;
  factIds?: string[];
  rawText: string;
}
```

Examples:

- detective: `intent: "confront"`, `targetId: "butler"`, `factIds: [...]`
- cultivation: `intent: "breakthrough"`, `targetId: "stone_seat"`
- romance: `intent: "confess"`, `targetId: "classmate_lin"`, `factIds: ["shared_lunch_memory"]`
- tabletop: `intent: "skill_check"`, `targetId: "sealed_gate"`, `itemId: "thieves_tools"`

The parser first handles stable command forms, then uses pack/profile aliases and entity names for natural language matching.

## Conditions

Supported condition forms:

```ts
type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { location_is: string }
  | { flag_true: string }
  | { has_item: string }
  | { knows_fact: string }
  | { objective_stage_is: { objective: string; stage: string } }
  | { relationship_at_least: { character: string; value: number } }
  | { relationship_at_most: { character: string; value: number } }
  | { resource_at_least: { resource: string; value: number } }
  | { resource_at_most: { resource: string; value: number } };
```

## Patches

Supported patch forms:

```ts
type GamePatch =
  | { type: "reveal_fact"; factId: string; reason: string }
  | { type: "add_item"; itemId: string; reason: string }
  | { type: "remove_item"; itemId: string; reason: string }
  | { type: "move_location"; locationId: string; reason: string }
  | { type: "set_flag"; flag: string; value: boolean; reason: string }
  | { type: "adjust_relationship"; characterId: string; delta: number; reason: string }
  | { type: "set_resource"; resourceId: string; value: number; reason: string }
  | { type: "adjust_resource"; resourceId: string; delta: number; reason: string }
  | { type: "set_objective_stage"; objectiveId: string; stage: string; reason: string };
```

Patch validation checks:

- patch type is allowed by pack rules.
- referenced IDs exist.
- fact reveal conditions pass.
- item pickup conditions pass.
- movement follows location exits and entry conditions.
- resource values stay within declared min/max.
- objective stages exist.
- relationship targets exist.

## Rule Triggers

`rules.yaml` keeps `allowedPatchTypes` and adds data-driven triggers:

```yaml
allowedPatchTypes:
  - reveal_fact
  - add_item
  - remove_item
  - move_location
  - set_flag
  - adjust_relationship
  - set_resource
  - adjust_resource
  - set_objective_stage

triggers:
  - id: confront_true_culprit
    on:
      action: act
      intent: confront
      targetId: butler
    when:
      all:
        - knows_fact: broken_watch
        - knows_fact: muddy_bootprint
        - knows_fact: tower_bell_record
    patches:
      - type: set_flag
        flag: accused_butler
        value: true
        reason: Player confronted the butler with the required facts.

  - id: wrong_confrontation
    on:
      action: act
      intent: confront
    when:
      not:
        all:
          - knows_fact: broken_watch
          - knows_fact: muddy_bootprint
          - knows_fact: tower_bell_record
    patches:
      - type: set_flag
        flag: wrong_confrontation
        value: true
        reason: Player confronted without enough support.
```

Trigger matching supports exact action type, intent, target ID, item ID, and optional fact requirements. `when` must pass. `unless` blocks the trigger when it passes. Mutually exclusive outcomes should be expressed directly in trigger conditions so an implementation can safely collect matching trigger patches before applying them.

This moves Rain Tower truth logic out of runtime and into the pack.

## Runtime Flow

The turn flow remains mostly the same:

1. Parse input into a core action using pack/profile lexicon.
2. Precheck movement, visible item pickup, talk target existence, and profile action target requirements.
3. Build agent context with generic facts/resources/relationships/objectives and profile labels.
4. Ask the model for structured narration, speech, and proposed patches.
5. Derive deterministic rule patches from pack triggers.
6. Validate and apply rule patches followed by accepted model patches.
7. Judge ending through generic conditions.
8. Build typed turn messages using profile labels.
9. Audit output against forbidden disclosures.

Agent-generated patches remain optional. Deterministic triggers own canonical progression.

## Agent Context and Prompts

Contexts should expose:

- `profile`
- `worldTone`
- `location`
- `currentState`
- `visibleItems`
- `visibleFacts`
- `knownFacts`
- `inventoryItems`
- `resources`
- `relationships`
- `objectives`
- `canonicalItems`
- `canonicalFacts`
- current character and topic for talk actions

Prompts should say "facts" in core instructions and tell the model to use `profile.labels.facts` for player-facing genre wording.

The response prompt should list generic patch types only.

## Web UI

Web UI becomes pack/profile-driven:

- Title, intro, and world text come from pack data.
- Sidebar panel labels come from `profile.labels`.
- Quick actions come from `profile.quickActions`.
- Location, character, item, fact, and objective labels come from loaded pack data, not hardcoded maps.
- Message type `fact` displays using `profile.labels.facts`.
- The UI must not say "case", "clue", "murder", or "investigation" unless the active profile/pack says so.

The UI can keep its current two-column interaction layout, but copy and labels must be data-driven.

## CLI and Simulator

CLI changes:

- `clues <sessionId>` becomes `facts <sessionId>`.
- `state` prints location, turn, inventory, known facts, resources, relationships, flags, and objective stages.
- `play` and `trace` keep their roles but use generic patch/action formatting.
- `validate` checks profile, facts, resources, objectives, and rule triggers.

Simulator assertions:

```yaml
expectedKnownFacts:
  - broken_watch
expectedFlags:
  accused_butler: true
expectedResources:
  spiritual_power: 5
expectedRelationships:
  classmate_lin: 4
expectedObjectiveStages:
  solve_murder: resolved
expectedEnding: true_resolution
forbiddenOutputPhrases:
  - hidden culprit phrase
```

## Sample Pack Matrix

The implementation should add six packs to force architectural generality.

### Small: `campus-lunch`

Genre: romance.

Shape:

- 2 locations.
- 2 characters.
- 3 facts.
- 1 relationship.
- 1 objective.
- 2 endings.

Coverage:

- Relationship change.
- `comfort`, `invite`, or `confess` intent.
- Romance labels for facts as memories or misunderstandings.

### Small: `cave-breakthrough`

Genre: cultivation.

Shape:

- 2 locations.
- 1 character or mentor echo.
- 2 resources: spiritual power and heart demon pressure.
- 3 facts.
- 1 objective.
- 2 endings.

Coverage:

- Resource thresholds.
- `cultivate` and `breakthrough` intents.
- Resource increase/decrease patches.

### Medium: `rain-tower`

Genre: detective.

Shape:

- Existing 3 locations.
- Existing 3 characters.
- Existing 6 facts migrated from clues.
- Existing 2 items.
- 1 objective.
- 3 endings.

Coverage:

- Detective profile labels facts as clues.
- `confront` replaces `accuse`.
- True and wrong confrontation are rule triggers.

### Medium: `ember-crypt`

Genre: tabletop fantasy.

Shape:

- 4 locations.
- 3 characters or enemies.
- 4 items.
- 3 resources: HP, gold, spell slot.
- 5 facts.
- 2 objectives.
- 3 endings.

Coverage:

- `skill_check`, `negotiate`, and combat-like `act` intents.
- Resource consumption.
- Objective progression.

### Large: `mist-sect`

Genre: cultivation.

Shape:

- 6 to 8 locations.
- 5 to 6 characters.
- 8 to 12 facts.
- 4 resources.
- 4 objectives.
- 4 or more endings.

Coverage:

- Multiple resource and relationship gates.
- Multiple objective stages.
- Endings based on combined state.

### Large: `spring-festival`

Genre: romance.

Shape:

- 6 locations.
- 5 characters.
- 10 facts or memories.
- 5 relationship tracks.
- 3 objectives.
- 4 endings.

Coverage:

- Multiple relationship routes.
- Memory facts.
- `invite`, `comfort`, and `confess` intents.
- Non-detective UI over a larger pack.

## Validation and Test Strategy

Validation must cover:

- Required v0.2 pack files exist.
- Manifest profile ID matches `profile.yaml`.
- All location exits exist.
- Visible object references point to items or facts.
- Character topics reference existing facts.
- Fact, item, objective, resource, and relationship conditions reference existing IDs.
- Rule trigger action intents are declared in profile actions or are one of the core actions.
- Trigger patches validate against pack schema.
- Ending conditions reference existing IDs.
- Resource initial/min/max values are coherent.
- Objective initial stage is listed in stages.

Tests should include:

- Domain schema tests for generic state, actions, conditions, patches, and initial state.
- Condition tests for facts, resources, relationships, objectives, and boolean composition.
- Patch validation and application tests for all generic patch types.
- Trigger tests proving Rain Tower true and wrong confrontation come from pack data, not runtime code.
- Pack validation tests for all six packs.
- Simulator tests for at least one script per pack.
- Web component tests proving labels and quick actions come from profile data.
- CLI tests for `facts`, state output, generic simulation assertions, and trace formatting.

Completion checks:

- `npm test`
- `npm run typecheck`
- `npm run cli -- validate <pack>` for every pack.
- `npm run cli -- simulate <pack> <script>` for every pack script.
- `npm run e2e` if Web behavior changes.
- Repository search confirms core code does not contain detective-specific identifiers such as `clue`, `accuse`, `murder`, or `case`, except inside detective pack content, migration docs, and explicit historical references.

## Migration Plan

1. Introduce v0.2 domain schema and tests.
2. Update conditions and patches to generic names.
3. Add trigger evaluation to rules.
4. Update action parsing to generic `talk` and `act`.
5. Update orchestrator to use trigger-derived patches instead of hardcoded detective logic.
6. Update agent contexts and prompts to generic facts/profile language.
7. Update pack loader and validator for new file structure.
8. Migrate `rain-tower` to v0.2.
9. Add small packs, then medium packs, then large packs.
10. Update CLI, simulator, and Web UI to read profile labels and quick actions.
11. Run full validation and remove remaining detective-specific core names.

## Open Decisions Resolved

- Breaking schema migration is allowed.
- v0.2 should include both a generic narrative state layer and data-driven genre profiles.
- Genre profiles are data-driven in this version, not executable TypeScript modules.
- The recommended approach is core runtime plus genre profile plus world pack.

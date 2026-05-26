# Generic Genre Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the detective-specific v0.1 runtime with a v0.2 generic world runtime driven by universal state plus data-driven genre profiles, then validate it with small, medium, and large packs across detective, cultivation, romance, and tabletop fantasy genres.

**Architecture:** Core runtime owns locations, characters, items, facts, resources, relationships, objectives, flags, rule triggers, and endings. Genre profiles provide vocabulary, quick actions, and intent aliases without executable pack code. World packs own concrete content and progression rules.

**Tech Stack:** TypeScript, Zod, YAML, Vitest, Next.js, Playwright, SQLite persistence.

---

## File Structure

Modify these core files:

- `packages/shared/src/domain.ts`: v0.2 schemas and exported types.
- `packages/shared/src/domain.test.ts`: schema and initial-state tests.
- `packages/rules/src/conditions.ts`: generic condition evaluator.
- `packages/rules/src/conditions.test.ts`: condition coverage.
- `packages/rules/src/patches.ts`: generic patch validation and application.
- `packages/rules/src/patches.test.ts`: patch coverage.
- `packages/rules/src/triggers.ts`: new data-driven trigger matching.
- `packages/rules/src/triggers.test.ts`: trigger coverage.
- `packages/rules/src/endings.ts`: keep generic ending judge with renamed state fields.
- `packages/rules/src/endings.test.ts`: generic ending tests.
- `packages/rules/src/index.ts`: export triggers.
- `packages/pack/src/loadPack.ts`: v0.2 pack file loading.
- `packages/pack/src/loadPack.test.ts`: v0.2 load tests.
- `packages/pack/src/validatePack.ts`: v0.2 reference validation.
- `packages/pack/src/validatePack.test.ts`: v0.2 validation tests.
- `packages/pack/src/packagePack.ts`: archive format metadata.
- `packages/pack/src/packagePack.test.ts`: archive tests.
- `packages/pack/src/samplePack.test.ts`: all pack validation.
- `packages/runtime/src/actionParser.ts`: generic `talk` and `act` parser.
- `packages/runtime/src/actionParser.test.ts`: parser tests.
- `packages/runtime/src/orchestrator.ts`: trigger-derived patches and generic messages.
- `packages/runtime/src/orchestrator.test.ts`: runtime tests.
- `packages/runtime/src/simulator.ts`: generic assertions.
- `packages/runtime/src/simulator.test.ts`: simulator tests.
- `packages/agents/src/contexts.ts`: generic facts/profile context.
- `packages/agents/src/contexts.test.ts`: context tests.
- `packages/agents/src/fakeProvider.ts`: generic response field names.
- `packages/agents/src/prompts/core.md`: generic facts wording.
- `packages/agents/src/prompts/narrator.md`: generic actions wording.
- `packages/agents/src/prompts/npc.md`: rename NPC wording to character wording where core-facing.
- `packages/agents/src/prompts/response.md`: generic patch list.
- `packages/agents/src/prompts.test.ts`: prompt assertions.
- `apps/cli/src/main.ts`: generic `facts` command and assertions.
- `apps/cli/src/main.test.ts`: CLI tests.
- `apps/web/app/api/session/route.ts`: profile-driven intro and pack metadata response.
- `apps/web/src/components/GameShell.tsx`: profile-driven labels, quick actions, pack entity labels.
- `apps/web/src/components/GameShell.test.tsx`: component tests.
- `apps/web/tests/player.spec.ts`: e2e expectations.
- `README.md`: update usage and architecture wording.

Create these pack folders:

- `packs/campus-lunch`
- `packs/cave-breakthrough`
- `packs/ember-crypt`
- `packs/mist-sect`
- `packs/spring-festival`

Migrate this folder:

- `packs/rain-tower`

---

### Task 1: Shared v0.2 Domain Schema

**Files:**
- Modify: `packages/shared/src/domain.ts`
- Modify: `packages/shared/src/domain.test.ts`

- [ ] **Step 1: Write failing domain tests**

Replace detective-specific tests in `packages/shared/src/domain.test.ts` with tests for the v0.2 shape:

```ts
import { describe, expect, it } from "vitest";
import {
  ActionSchema,
  PatchSchema,
  WorldPackSchema,
  createInitialSessionState
} from "./domain";

describe("v0.2 domain schema", () => {
  it("rejects detective-only v0.1 patch names", () => {
    expect(() => PatchSchema.parse({ type: "discover_clue", clueId: "broken_watch", reason: "old" })).toThrow();
    expect(() => ActionSchema.parse({ type: "accuse", npcId: "butler", clueIds: [], rawText: "old" })).toThrow();
  });

  it("parses generic act actions and fact patches", () => {
    expect(ActionSchema.parse({
      type: "act",
      intent: "confront",
      targetId: "butler",
      factIds: ["broken_watch"],
      rawText: "confront butler with broken_watch"
    })).toMatchObject({ type: "act", intent: "confront" });

    expect(PatchSchema.parse({
      type: "reveal_fact",
      factId: "broken_watch",
      reason: "Player inspected the watch."
    })).toMatchObject({ type: "reveal_fact", factId: "broken_watch" });
  });

  it("creates initial state from resources, relationships, and objectives", () => {
    const pack = WorldPackSchema.parse({
      manifest: {
        id: "campus-lunch",
        name: "Campus Lunch",
        version: "0.2.0",
        runtimeVersion: "0.2.0",
        entryLocationId: "classroom",
        profileId: "romance"
      },
      worldText: "A lunch-break misunderstanding.",
      profile: {
        id: "romance",
        labels: { facts: "回忆", inventory: "随身物", objectives: "关系进展" },
        quickActions: [],
        actions: { confess: { aliases: ["confess", "告白"], requiresTarget: "character", acceptsFacts: true } }
      },
      rules: { allowedPatchTypes: ["reveal_fact", "adjust_relationship", "set_objective_stage"], triggers: [] },
      locations: [{ id: "classroom", name: "教室", description: "午休前的教室。", exits: [], visibleObjects: [] }],
      characters: [{ id: "lin", name: "林同学", publicDescription: "她正在收拾便当。", topics: [] }],
      facts: [],
      items: [],
      resources: [{ id: "courage", name: "勇气", initial: 1, min: 0, max: 5 }],
      relationships: [{ characterId: "lin", name: "林同学好感", initial: 2, min: -5, max: 10 }],
      objectives: [{ id: "repair_lunch", name: "修复午休误会", stages: ["awkward", "honest"], initialStage: "awkward" }],
      endings: []
    });

    expect(createInitialSessionState(pack)).toEqual({
      currentLocationId: "classroom",
      turn: 0,
      inventory: [],
      knownFacts: [],
      resources: { courage: 1 },
      relationships: { lin: 2 },
      flags: {},
      objectiveStages: { repair_lunch: "awkward" }
    });
  });
});
```

- [ ] **Step 2: Run the focused failing test**

Run: `npm test -- packages/shared/src/domain.test.ts`

Expected: FAIL because schemas still expose `knownClues`, `clues`, `npcs`, `quests`, `accuse`, and `discover_clue`.

- [ ] **Step 3: Replace domain schemas**

In `packages/shared/src/domain.ts`, define these exported schemas and types:

```ts
export const ManifestSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  runtimeVersion: z.string().min(1),
  entryLocationId: IdSchema,
  profileId: IdSchema
});

export const ProfileSchema = z.object({
  id: IdSchema,
  labels: z.record(z.string(), z.string().min(1)).default({}),
  quickActions: z.array(z.object({
    label: z.string().min(1),
    command: z.string().min(1)
  })).default([]),
  actions: z.record(z.string(), z.object({
    aliases: z.array(z.string().min(1)).default([]),
    mapsTo: z.string().min(1).optional(),
    requiresTarget: z.enum(["character", "item", "location", "fact"]).optional(),
    acceptsFacts: z.boolean().default(false)
  })).default({})
});
```

Add generic `ConditionSchema`, `CharacterSchema`, `FactSchema`, `ResourceSchema`, `RelationshipSchema`, `ObjectiveSchema`, `RuleTriggerSchema`, `RulesSchema`, `WorldPackSchema`, `SessionStateSchema`, `ActionSchema`, `PatchSchema`, and `TurnMessageSchema` matching the design spec.

Keep `IdSchema` unchanged.

- [ ] **Step 4: Implement generic initial state**

Update `createInitialSessionState(pack)` to initialize:

```ts
return {
  currentLocationId: pack.manifest.entryLocationId,
  turn: 0,
  inventory: [],
  knownFacts: [],
  resources: Object.fromEntries(pack.resources.map((resource) => [resource.id, resource.initial])),
  relationships: Object.fromEntries(pack.relationships.map((relationship) => [relationship.characterId, relationship.initial])),
  flags: {},
  objectiveStages: Object.fromEntries(pack.objectives.map((objective) => [objective.id, objective.initialStage]))
};
```

- [ ] **Step 5: Run the focused passing test**

Run: `npm test -- packages/shared/src/domain.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/domain.ts packages/shared/src/domain.test.ts
git commit -m "feat: add generic v0.2 domain schema"
```

---

### Task 2: Generic Conditions

**Files:**
- Modify: `packages/rules/src/conditions.ts`
- Modify: `packages/rules/src/conditions.test.ts`

- [ ] **Step 1: Write failing condition tests**

Update `packages/rules/src/conditions.test.ts` to cover:

```ts
const state: SessionState = {
  currentLocationId: "cave",
  turn: 2,
  inventory: ["jade_token"],
  knownFacts: ["stone_omen"],
  resources: { spiritual_power: 5, heart_demon: 1 },
  relationships: { mentor_echo: 3 },
  flags: { incense_lit: true },
  objectiveStages: { breakthrough: "prepared" }
};

expect(evaluateCondition({ knows_fact: "stone_omen" }, state)).toBe(true);
expect(evaluateCondition({ objective_stage_is: { objective: "breakthrough", stage: "prepared" } }, state)).toBe(true);
expect(evaluateCondition({ relationship_at_least: { character: "mentor_echo", value: 3 } }, state)).toBe(true);
expect(evaluateCondition({ relationship_at_most: { character: "mentor_echo", value: 2 } }, state)).toBe(false);
expect(evaluateCondition({ resource_at_least: { resource: "spiritual_power", value: 4 } }, state)).toBe(true);
expect(evaluateCondition({ resource_at_most: { resource: "heart_demon", value: 1 } }, state)).toBe(true);
expect(evaluateCondition({ all: [{ flag_true: "incense_lit" }, { has_item: "jade_token" }] }, state)).toBe(true);
```

- [ ] **Step 2: Run the focused failing test**

Run: `npm test -- packages/rules/src/conditions.test.ts`

Expected: FAIL because condition names still use clue, quest, and NPC attitude terms.

- [ ] **Step 3: Implement generic evaluator**

Replace old branches:

```ts
if ("knows_fact" in condition) return state.knownFacts.includes(condition.knows_fact);
if ("objective_stage_is" in condition) {
  return state.objectiveStages[condition.objective_stage_is.objective] === condition.objective_stage_is.stage;
}
if ("relationship_at_least" in condition) {
  return (state.relationships[condition.relationship_at_least.character] ?? 0) >= condition.relationship_at_least.value;
}
if ("relationship_at_most" in condition) {
  return (state.relationships[condition.relationship_at_most.character] ?? 0) <= condition.relationship_at_most.value;
}
if ("resource_at_least" in condition) {
  return (state.resources[condition.resource_at_least.resource] ?? 0) >= condition.resource_at_least.value;
}
if ("resource_at_most" in condition) {
  return (state.resources[condition.resource_at_most.resource] ?? 0) <= condition.resource_at_most.value;
}
```

Remove `knows_clue`, `quest_stage_is`, and `npc_attitude_at_least` support from core.

- [ ] **Step 4: Run the focused passing test**

Run: `npm test -- packages/rules/src/conditions.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/rules/src/conditions.ts packages/rules/src/conditions.test.ts
git commit -m "feat: evaluate generic world conditions"
```

---

### Task 3: Generic Patch Validation and Application

**Files:**
- Modify: `packages/rules/src/patches.ts`
- Modify: `packages/rules/src/patches.test.ts`

- [ ] **Step 1: Write failing patch tests**

Use a generic pack fixture with facts, resources, relationships, and objectives. Assert these behaviors:

```ts
expect(validatePatch({ type: "reveal_fact", factId: "stone_omen", reason: "Observed." }, pack, state)).toEqual({ ok: true });
expect(applyAcceptedPatch({ type: "reveal_fact", factId: "stone_omen", reason: "Observed." }, state).knownFacts).toEqual(["stone_omen"]);
expect(applyAcceptedPatch({ type: "adjust_resource", resourceId: "spiritual_power", delta: 2, reason: "Cultivated." }, state).resources.spiritual_power).toBe(4);
expect(applyAcceptedPatch({ type: "set_resource", resourceId: "heart_demon", value: 0, reason: "Calmed." }, state).resources.heart_demon).toBe(0);
expect(applyAcceptedPatch({ type: "adjust_relationship", characterId: "mentor_echo", delta: 1, reason: "Listened." }, state).relationships.mentor_echo).toBe(1);
expect(applyAcceptedPatch({ type: "set_objective_stage", objectiveId: "breakthrough", stage: "ready", reason: "Prepared." }, state).objectiveStages.breakthrough).toBe("ready");
```

Also assert validation rejects unknown fact/resource/character/objective IDs and resource values outside min/max.

- [ ] **Step 2: Run the focused failing test**

Run: `npm test -- packages/rules/src/patches.test.ts`

Expected: FAIL because patch names and state fields are still v0.1.

- [ ] **Step 3: Implement generic patch validation**

In `validatePatch`, replace detective checks with:

```ts
if (patch.type === "reveal_fact") {
  const fact = pack.facts.find((candidate) => candidate.id === patch.factId);
  if (!fact) return { ok: false, reason: `Unknown fact: ${patch.factId}` };
  if (!evaluateCondition(fact.discoverableWhen, state)) {
    return { ok: false, reason: `Fact reveal condition failed: ${patch.factId}` };
  }
}
```

Add resource bound validation:

```ts
function validateResourceValue(resourceId: string, value: number, pack: WorldPack): PatchValidation {
  const resource = pack.resources.find((candidate) => candidate.id === resourceId);
  if (!resource) return { ok: false, reason: `Unknown resource: ${resourceId}` };
  if (value < resource.min || value > resource.max) {
    return { ok: false, reason: `Resource out of bounds: ${resourceId}=${value}` };
  }
  return { ok: true };
}
```

Use current state plus delta for `adjust_resource`.

- [ ] **Step 4: Implement generic patch application**

Copy state immutably and update:

```ts
knownFacts: [...state.knownFacts],
resources: { ...state.resources },
relationships: { ...state.relationships },
objectiveStages: { ...state.objectiveStages }
```

Apply each generic patch type exactly once and keep duplicate facts/items idempotent.

- [ ] **Step 5: Run the focused passing test**

Run: `npm test -- packages/rules/src/patches.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/rules/src/patches.ts packages/rules/src/patches.test.ts
git commit -m "feat: validate and apply generic patches"
```

---

### Task 4: Rule Trigger Engine

**Files:**
- Create: `packages/rules/src/triggers.ts`
- Create: `packages/rules/src/triggers.test.ts`
- Modify: `packages/rules/src/index.ts`

- [ ] **Step 1: Write failing trigger tests**

Create tests for Rain Tower-style confrontation:

```ts
import { describe, expect, it } from "vitest";
import type { GameAction, SessionState, WorldPack } from "@aigame/shared";
import { deriveTriggerPatches } from "./triggers";

describe("deriveTriggerPatches", () => {
  it("derives true confrontation patches from pack triggers", () => {
    const action: GameAction = { type: "act", intent: "confront", targetId: "butler", factIds: ["broken_watch"], rawText: "confront" };
    const state: SessionState = {
      currentLocationId: "foyer",
      turn: 1,
      inventory: [],
      knownFacts: ["broken_watch", "muddy_bootprint", "tower_bell_record"],
      resources: {},
      relationships: {},
      flags: {},
      objectiveStages: { solve_murder: "confront" }
    };

    expect(deriveTriggerPatches(pack, state, action)).toEqual([
      { type: "set_flag", flag: "accused_butler", value: true, reason: "Required facts matched." }
    ]);
  });
});
```

Add a second test where the action lacks required facts and returns a wrong-confrontation patch.

- [ ] **Step 2: Run the focused failing test**

Run: `npm test -- packages/rules/src/triggers.test.ts`

Expected: FAIL because the file does not exist.

- [ ] **Step 3: Implement trigger matching**

Create:

```ts
export function deriveTriggerPatches(pack: WorldPack, state: SessionState, action: GameAction): GamePatch[] {
  return pack.rules.triggers.flatMap((trigger) => {
    if (!matchesTriggerAction(trigger.on, action)) return [];
    if (trigger.when && !evaluateCondition(trigger.when, state)) return [];
    if (trigger.unless && evaluateCondition(trigger.unless, state)) return [];
    return trigger.patches;
  });
}
```

Implement `matchesTriggerAction` for `action`, `intent`, `targetId`, `itemId`, `locationId`, and `factIds` intersection/containment using explicit properties from the trigger schema.

- [ ] **Step 4: Export triggers**

Update `packages/rules/src/index.ts`:

```ts
export * from "./conditions";
export * from "./patches";
export * from "./endings";
export * from "./triggers";
```

- [ ] **Step 5: Run the focused passing test**

Run: `npm test -- packages/rules/src/triggers.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/rules/src/triggers.ts packages/rules/src/triggers.test.ts packages/rules/src/index.ts
git commit -m "feat: derive patches from pack rule triggers"
```

---

### Task 5: v0.2 Pack Loader and Validator

**Files:**
- Modify: `packages/pack/src/loadPack.ts`
- Modify: `packages/pack/src/loadPack.test.ts`
- Modify: `packages/pack/src/validatePack.ts`
- Modify: `packages/pack/src/validatePack.test.ts`
- Modify: `packages/pack/src/packagePack.ts`
- Modify: `packages/pack/src/packagePack.test.ts`

- [ ] **Step 1: Write failing loader tests**

Update mini-pack creation to write these required files:

```ts
writeFileSync(join(root, "manifest.yaml"), [
  "id: campus-lunch",
  "name: Campus Lunch",
  "version: 0.2.0",
  "runtimeVersion: 0.2.0",
  "entryLocationId: classroom",
  "profileId: romance"
].join("\n"));
writeFileSync(join(root, "profile.yaml"), "id: romance\nlabels:\n  facts: 回忆\nquickActions: []\nactions: {}\n");
writeFileSync(join(root, "characters.yaml"), "[]\n");
writeFileSync(join(root, "facts.yaml"), "[]\n");
writeFileSync(join(root, "resources.yaml"), "[]\n");
writeFileSync(join(root, "relationships.yaml"), "[]\n");
writeFileSync(join(root, "objectives.yaml"), "[]\n");
```

Assert the loaded pack has `profile.id === "romance"` and no `prompts`.

- [ ] **Step 2: Run failing loader tests**

Run: `npm test -- packages/pack/src/loadPack.test.ts`

Expected: FAIL because `loadWorldPack` still reads `npcs.yaml`, `clues.yaml`, and `quests.yaml`.

- [ ] **Step 3: Update loader**

Change `loadWorldPack` to read:

```ts
const pack = {
  manifest: readYamlFile(root, "manifest.yaml"),
  worldText: readRequiredFile(root, "world.md"),
  profile: readYamlFile(root, "profile.yaml"),
  rules: readYamlFile(root, "rules.yaml"),
  locations: readYamlFile(root, "locations.yaml"),
  characters: readYamlFile(root, "characters.yaml"),
  facts: readYamlFile(root, "facts.yaml"),
  items: readYamlFile(root, "items.yaml"),
  resources: readYamlFile(root, "resources.yaml"),
  relationships: readYamlFile(root, "relationships.yaml"),
  objectives: readYamlFile(root, "objectives.yaml"),
  endings: readYamlFile(root, "endings.yaml")
};
```

- [ ] **Step 4: Write failing validator tests**

Cover:

- manifest `profileId` does not match `profile.id`.
- location visible object references missing item/fact.
- character topic `revealsFactId` missing.
- `knows_fact` references missing fact.
- `resource_at_least` references missing resource.
- trigger intent missing from profile actions for `act`.
- trigger patch references missing objective stage.

- [ ] **Step 5: Update validator**

Build reference sets:

```ts
const references = {
  locationIds,
  characterIds,
  factIds,
  itemIds,
  resourceIds,
  objectiveIds,
  objectives: pack.objectives,
  profileActionIds: new Set(Object.keys(pack.profile.actions))
};
```

Update condition reference collection for `knows_fact`, `objective_stage_is`, relationship, and resource condition nodes.

Validate trigger `on.intent` when `on.action === "act"`:

```ts
if (trigger.on.action === "act" && trigger.on.intent && !references.profileActionIds.has(trigger.on.intent)) {
  errors.push(`Trigger ${trigger.id} references missing profile action: ${trigger.on.intent}`);
}
```

- [ ] **Step 6: Update package archive format**

In `packages/pack/src/packagePack.ts`, change:

```ts
format: "aigame.pack.v2"
```

and update tests to assert v2.

- [ ] **Step 7: Run pack tests**

Run: `npm test -- packages/pack/src/loadPack.test.ts packages/pack/src/validatePack.test.ts packages/pack/src/packagePack.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/pack/src/loadPack.ts packages/pack/src/loadPack.test.ts packages/pack/src/validatePack.ts packages/pack/src/validatePack.test.ts packages/pack/src/packagePack.ts packages/pack/src/packagePack.test.ts
git commit -m "feat: load and validate v0.2 world packs"
```

---

### Task 6: Generic Action Parser

**Files:**
- Modify: `packages/runtime/src/actionParser.ts`
- Modify: `packages/runtime/src/actionParser.test.ts`

- [ ] **Step 1: Write failing parser tests**

Assert these command forms:

```ts
expect(parseAction("talk lin about lunch")).toEqual({ type: "talk", characterId: "lin", topic: "lunch", rawText: "talk lin about lunch" });
expect(parseAction("confront butler with broken_watch muddy_bootprint", lexicon)).toEqual({
  type: "act",
  intent: "confront",
  targetId: "butler",
  factIds: ["broken_watch", "muddy_bootprint"],
  rawText: "confront butler with broken_watch muddy_bootprint"
});
expect(parseAction("突破", cultivationLexicon)).toMatchObject({ type: "act", intent: "breakthrough" });
```

Use `characters` and `facts` in the lexicon. Remove `npcs`, `clues`, and `accuse` expectations.

- [ ] **Step 2: Run the focused failing test**

Run: `npm test -- packages/runtime/src/actionParser.test.ts`

Expected: FAIL because parser still returns `ask` and `accuse`.

- [ ] **Step 3: Update parser types**

Change `ActionLexicon` to:

```ts
export interface ActionLexicon {
  profile?: WorldPack["profile"];
  locations?: Array<{ id: string; name?: string; aliases?: string[] }>;
  characters?: Array<{ id: string; name?: string; aliases?: string[]; topics?: Array<{ id: string; prompt?: string; aliases?: string[] }> }>;
  items?: Array<{ id: string; name?: string; aliases?: string[] }>;
  facts?: Array<{ id: string; name?: string; aliases?: string[] }>;
}
```

- [ ] **Step 4: Implement stable command forms**

Support:

```ts
talk <character> about <topic>
act <intent> [target] [with fact...]
<profile action alias> <target> with <fact...>
```

Map profile aliases to `act.intent`.

- [ ] **Step 5: Update natural language matching**

Natural matching should use `characters`, `items`, `facts`, and `locations`. Chinese question aliases return `talk`; action aliases from `profile.actions` return `act`.

- [ ] **Step 6: Run parser tests**

Run: `npm test -- packages/runtime/src/actionParser.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/runtime/src/actionParser.ts packages/runtime/src/actionParser.test.ts
git commit -m "feat: parse generic profile actions"
```

---

### Task 7: Runtime Orchestrator and Simulator

**Files:**
- Modify: `packages/runtime/src/orchestrator.ts`
- Modify: `packages/runtime/src/orchestrator.test.ts`
- Modify: `packages/runtime/src/simulator.ts`
- Modify: `packages/runtime/src/simulator.test.ts`

- [ ] **Step 1: Write failing orchestrator tests**

Update fixtures to v0.2 and assert:

- inspecting a visible fact accepts `reveal_fact`.
- inspecting an item with `revealsFactId` emits a `fact` message using canonical description.
- `talk` routes to character actor and scopes context to one character.
- `act confront` gets true/wrong result from triggers.
- impossible movement precheck still avoids model call.

Use expected message shape:

```ts
{
  type: "fact",
  factId: "broken_watch",
  label: "Broken Watch",
  text: "The silver pocket watch is cracked and stopped at 8:47."
}
```

- [ ] **Step 2: Run failing runtime tests**

Run: `npm test -- packages/runtime/src/orchestrator.test.ts`

Expected: FAIL because runtime still uses clue fields and hardcoded accusation logic.

- [ ] **Step 3: Update imports and action routing**

Import trigger engine:

```ts
import { applyAcceptedPatch, deriveTriggerPatches, evaluateCondition, judgeEnding, validatePatch } from "@aigame/rules";
```

Route `talk` actions to character context:

```ts
if (action.type === "talk") {
  return {
    agentRole: "character",
    context: buildCharacterContext(pack, state, { characterId: action.characterId, topic: action.topic }),
    contextIds: [`location:${state.currentLocationId}`, `character:${action.characterId}`],
    system: buildSystemPrompt("character")
  };
}
```

- [ ] **Step 4: Replace deterministic patch derivation**

Remove Rain Tower hardcoded logic. Use:

```ts
const rulePatches = [
  ...deriveInspectionPatches(action, input.pack, input.state),
  ...deriveTakeMovePatches(action, input.pack, input.state),
  ...deriveTriggerPatches(input.pack, input.state, action)
];
```

`deriveInspectionPatches` handles visible facts and item `revealsFactId`. `deriveTakeMovePatches` handles generic item pickup and movement.

- [ ] **Step 5: Update messages and localization**

Replace `clue` message type with `fact`. Format text using generic labels:

```ts
if (message.type === "fact") return `${pack.profile.labels.facts ?? "Fact"}: ${message.label ?? message.factId} - ${message.text}`;
```

Replace blocked-action localization strings with generic wording: fact, character, objective, resource.

- [ ] **Step 6: Update simulator assertions**

Change interface:

```ts
export interface SimulationAssertions {
  expectedKnownFacts?: string[];
  expectedFlags?: Record<string, boolean>;
  expectedResources?: Record<string, number>;
  expectedRelationships?: Record<string, number>;
  expectedObjectiveStages?: Record<string, string>;
  forbiddenOutputPhrases?: string[];
}
```

Update collection logic to compare these fields.

- [ ] **Step 7: Run runtime tests**

Run: `npm test -- packages/runtime/src/orchestrator.test.ts packages/runtime/src/simulator.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/runtime/src/orchestrator.ts packages/runtime/src/orchestrator.test.ts packages/runtime/src/simulator.ts packages/runtime/src/simulator.test.ts
git commit -m "feat: run generic profile-driven turns"
```

---

### Task 8: Agent Contexts and Prompts

**Files:**
- Modify: `packages/agents/src/contexts.ts`
- Modify: `packages/agents/src/contexts.test.ts`
- Modify: `packages/agents/src/fakeProvider.ts`
- Modify: `packages/agents/src/prompts/core.md`
- Modify: `packages/agents/src/prompts/narrator.md`
- Modify: `packages/agents/src/prompts/npc.md`
- Modify: `packages/agents/src/prompts/response.md`
- Modify: `packages/agents/src/prompts.test.ts`
- Modify: `packages/agents/src/prompts.ts`

- [ ] **Step 1: Write failing context tests**

Assert narrator context contains:

```ts
expect(context.profile.id).toBe("cultivation");
expect(context.knownFacts).toEqual([{ id: "stone_omen", name: "石壁灵纹", description: "..." }]);
expect(context.resources).toEqual({ spiritual_power: 5 });
expect(JSON.stringify(context)).not.toContain("private mentor secret");
```

Assert character context contains only one character and `knownFactDetails`.

- [ ] **Step 2: Run failing agent tests**

Run: `npm test -- packages/agents/src/contexts.test.ts packages/agents/src/prompts.test.ts`

Expected: FAIL because contexts and prompts still use clue/NPC naming.

- [ ] **Step 3: Rename role type**

In `prompts.ts`, change:

```ts
export type AgentPromptRole = "narrator" | "character";
const rolePrompt = role === "character" ? "npc" : "narrator";
```

Keep the file name `npc.md` for this pass if renaming it would add churn; update content to describe the current character.

- [ ] **Step 4: Update contexts**

Expose generic fields:

```ts
const knownFacts = pack.facts.filter((fact) => state.knownFacts.includes(fact.id));
const visibleFacts = pack.facts.filter((fact) => visibleObjects.includes(fact.id));
return {
  profile: pack.profile,
  actionText: input.actionText,
  location,
  currentState: state,
  visibleObjects,
  visibleItems,
  visibleFacts,
  inventoryItems,
  knownFacts,
  resources: state.resources,
  relationships: state.relationships,
  objectiveStages: state.objectiveStages,
  canonicalItems: pack.items,
  canonicalFacts: pack.facts,
  turn: state.turn,
  worldTone: pack.worldText
};
```

- [ ] **Step 5: Update prompt files**

`core.md` must use generic terms:

```md
所有可用事实只能来自本轮 `context`，包括当前位置、当前状态、已知事实、可见事实、可见物、背包、当前角色、话题、世界基调、profile 标签和标准物品/事实列表。
```

`response.md` must list:

```md
`proposedPatches` 只能使用以下类型和精确字段名：`reveal_fact`、`add_item`、`remove_item`、`move_location`、`set_flag`、`adjust_relationship`、`set_resource`、`adjust_resource`、`set_objective_stage`。
```

- [ ] **Step 6: Run agent tests**

Run: `npm test -- packages/agents/src/contexts.test.ts packages/agents/src/prompts.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/agents/src/contexts.ts packages/agents/src/contexts.test.ts packages/agents/src/fakeProvider.ts packages/agents/src/prompts/core.md packages/agents/src/prompts/narrator.md packages/agents/src/prompts/npc.md packages/agents/src/prompts/response.md packages/agents/src/prompts.test.ts packages/agents/src/prompts.ts
git commit -m "feat: build generic agent contexts"
```

---

### Task 9: Pack Migration and New Pack Matrix

**Files:**
- Modify all files under: `packs/rain-tower`
- Create all files under: `packs/campus-lunch`
- Create all files under: `packs/cave-breakthrough`
- Create all files under: `packs/ember-crypt`
- Create all files under: `packs/mist-sect`
- Create all files under: `packs/spring-festival`
- Modify: `packages/pack/src/samplePack.test.ts`

- [ ] **Step 1: Update sample pack test**

Assert all six packs load and validate:

```ts
const packIds = ["campus-lunch", "cave-breakthrough", "rain-tower", "ember-crypt", "mist-sect", "spring-festival"];

for (const packId of packIds) {
  const pack = loadWorldPack(`packs/${packId}`);
  const result = validateWorldPack(pack);
  expect(result.errors).toEqual([]);
}
```

Add count checks:

```ts
expect(loadWorldPack("packs/campus-lunch").manifest.profileId).toBe("romance");
expect(loadWorldPack("packs/cave-breakthrough").resources.length).toBeGreaterThanOrEqual(2);
expect(loadWorldPack("packs/rain-tower").facts).toHaveLength(6);
expect(loadWorldPack("packs/ember-crypt").resources.map((resource) => resource.id).sort()).toEqual(["gold", "hp", "spell_slot"]);
expect(loadWorldPack("packs/mist-sect").locations.length).toBeGreaterThanOrEqual(6);
expect(loadWorldPack("packs/spring-festival").relationships.length).toBeGreaterThanOrEqual(5);
```

- [ ] **Step 2: Run failing sample pack test**

Run: `npm test -- packages/pack/src/samplePack.test.ts`

Expected: FAIL because packs do not exist or still use v0.1 files.

- [ ] **Step 3: Migrate Rain Tower**

Rename pack files:

```text
npcs.yaml -> characters.yaml
clues.yaml -> facts.yaml
quests.yaml -> objectives.yaml
```

Add:

```text
profile.yaml
resources.yaml
relationships.yaml
```

Convert fields:

```yaml
revealsClueId -> revealsFactId
knows_clue -> knows_fact
discover_clue -> reveal_fact
quest_stage_is -> objective_stage_is
set_quest_stage -> set_objective_stage
```

Move true/wrong confrontation logic into `packs/rain-tower/rules.yaml` triggers using `act` intent `confront`.

Update scripts:

```yaml
steps:
  - inspect silver_watch
  - move greenhouse
  - inspect muddy_bootprint
  - move study
  - inspect tower_bell_record
  - confront butler with broken_watch muddy_bootprint tower_bell_record
expectedKnownFacts:
  - broken_watch
  - muddy_bootprint
  - tower_bell_record
expectedFlags:
  accused_butler: true
expectedEnding: true_resolution
```

- [ ] **Step 4: Create `campus-lunch`**

Create a small romance pack:

- 2 locations: `classroom`, `courtyard`.
- 2 characters: `lin`, `hao`.
- 3 facts: `shared_lunch_memory`, `missed_note`, `hao_teasing`.
- 1 relationship: `lin`.
- 1 objective: `repair_lunch`.
- 2 endings: `honest_lunch`, `awkward_bell`.
- 1 script: `scripts/honest-path.yaml`.

Rules must include `comfort`, `invite`, and `confess` triggers that adjust relationship and reveal facts.

- [ ] **Step 5: Create `cave-breakthrough`**

Create a small cultivation pack:

- 2 locations: `outer_cave`, `stone_chamber`.
- 1 character: `mentor_echo`.
- 2 resources: `spiritual_power`, `heart_demon`.
- 3 facts: `stone_omen`, `quiet_breath`, `fractured_meridian`.
- 1 objective: `breakthrough`.
- 2 endings: `clear_breakthrough`, `failed_breakthrough`.
- 1 script: `scripts/clear-path.yaml`.

Rules must include `cultivate` and `breakthrough` triggers using resource thresholds.

- [ ] **Step 6: Create `ember-crypt`**

Create a medium tabletop fantasy pack:

- 4 locations: `camp`, `crypt_gate`, `ember_hall`, `sealed_vault`.
- 3 characters or enemies: `sellsword`, `gate_spirit`, `ash_wight`.
- 4 items: `old_map`, `thieves_tools`, `ember_key`, `healing_draught`.
- 3 resources: `hp`, `gold`, `spell_slot`.
- 5 facts.
- 2 objectives.
- 3 endings.
- 1 script: `scripts/vault-path.yaml`.

Rules must exercise `skill_check`, `negotiate`, and combat-like `act` intents.

- [ ] **Step 7: Create `mist-sect`**

Create a large cultivation pack:

- 6 to 8 locations.
- 5 to 6 characters.
- 8 to 12 facts.
- 4 resources.
- 4 objectives.
- 4 endings.
- 1 script: `scripts/orthodox-path.yaml`.

Rules must combine facts, relationships, resources, and objectives in at least three triggers.

- [ ] **Step 8: Create `spring-festival`**

Create a large romance pack:

- 6 locations.
- 5 characters.
- 10 facts or memories.
- 5 relationships.
- 3 objectives.
- 4 endings.
- 1 script: `scripts/festival-path.yaml`.

Rules must use `invite`, `comfort`, and `confess` intents and at least two relationship thresholds.

- [ ] **Step 9: Run pack tests and validation**

Run:

```bash
npm test -- packages/pack/src/samplePack.test.ts
npm run cli -- validate packs/campus-lunch
npm run cli -- validate packs/cave-breakthrough
npm run cli -- validate packs/rain-tower
npm run cli -- validate packs/ember-crypt
npm run cli -- validate packs/mist-sect
npm run cli -- validate packs/spring-festival
```

Expected: all commands pass.

- [ ] **Step 10: Commit**

```bash
git add packs packages/pack/src/samplePack.test.ts
git commit -m "feat: add generic genre sample packs"
```

---

### Task 10: CLI Generic State and Simulation

**Files:**
- Modify: `apps/cli/src/main.ts`
- Modify: `apps/cli/src/main.test.ts`

- [ ] **Step 1: Write failing CLI tests**

Update tests to expect:

```ts
expect(help.stderr).toContain("facts <sessionId>");
expect(state.stdout).toContain("Known facts:");
expect(state.stdout).toContain("Resources:");
expect(state.stdout).toContain("Relationships:");
expect(play.stdout).toContain("Accepted patches: reveal_fact broken_watch");
```

For simulation script parsing, assert `expectedKnownFacts`, `expectedResources`, `expectedRelationships`, and `expectedObjectiveStages` are passed through.

- [ ] **Step 2: Run failing CLI tests**

Run: `npm test -- apps/cli/src/main.test.ts`

Expected: FAIL because CLI still exposes `clues`.

- [ ] **Step 3: Update CLI command names and formatting**

Replace command branch:

```ts
if (command === "facts" && packPath) {
  const facts = session.state.knownFacts.length > 0
    ? session.state.knownFacts.map((factId) => `- ${factId}`).join("\n")
    : "No known facts.";
  return { exitCode: 0, stdout: `${facts}\n`, stderr: "" };
}
```

Update `formatState` with resources, relationships, and objective stages.

Update `formatPatch` for generic patch types.

- [ ] **Step 4: Update simulation output**

Change summary line:

```ts
`Known facts: ${result.finalState.knownFacts.join(",")}`
```

Parse script assertions:

```ts
expectedKnownFacts: script.expectedKnownFacts,
expectedResources: script.expectedResources,
expectedRelationships: script.expectedRelationships,
expectedObjectiveStages: script.expectedObjectiveStages
```

- [ ] **Step 5: Run CLI tests**

Run: `npm test -- apps/cli/src/main.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/cli/src/main.ts apps/cli/src/main.test.ts
git commit -m "feat: expose generic CLI state"
```

---

### Task 11: Web Profile-Driven UI

**Files:**
- Modify: `apps/web/app/api/session/route.ts`
- Modify: `apps/web/src/components/GameShell.tsx`
- Modify: `apps/web/src/components/GameShell.test.tsx`
- Modify: `apps/web/tests/player.spec.ts`

- [ ] **Step 1: Write failing session API/component tests**

Session response should include:

```ts
type SessionResponse = {
  sessionId: string;
  packId: string;
  manifest: WorldPack["manifest"];
  profile: WorldPack["profile"];
  entities: {
    locations: Array<{ id: string; name: string }>;
    characters: Array<{ id: string; name: string }>;
    items: Array<{ id: string; name: string }>;
    facts: Array<{ id: string; name: string }>;
    objectives: Array<{ id: string; name: string; stages: string[] }>;
  };
  state: SessionState;
  intro?: string;
};
```

Component tests should assert labels come from profile:

```ts
expect(screen.getByText("回忆")).toBeInTheDocument();
expect(screen.queryByText("已知线索")).not.toBeInTheDocument();
```

- [ ] **Step 2: Run failing Web tests**

Run: `npm test -- apps/web/src/components/GameShell.test.tsx apps/web/app/api/session/route.test.ts`

Expected: FAIL for missing profile metadata and hardcoded detective labels. If `route.test.ts` does not exist, create `apps/web/app/api/session/route.test.ts`.

- [ ] **Step 3: Update session route**

Return pack metadata:

```ts
return NextResponse.json({
  sessionId: session.id,
  packId: pack.manifest.id,
  manifest: pack.manifest,
  profile: pack.profile,
  entities: {
    locations: pack.locations.map(({ id, name }) => ({ id, name })),
    characters: pack.characters.map(({ id, name }) => ({ id, name })),
    items: pack.items.map(({ id, name }) => ({ id, name })),
    facts: pack.facts.map(({ id, name }) => ({ id, name })),
    objectives: pack.objectives.map(({ id, name, stages }) => ({ id, name, stages }))
  },
  intro: buildSessionIntro(pack),
  state
});
```

Build intro generically:

```ts
return `你进入《${pack.manifest.name}》。${worldText} ${locationText}${objectiveText}`.trim();
```

- [ ] **Step 4: Update GameShell state**

Replace hardcoded maps with entity lookup maps built from session response:

```ts
const labels = body.profile.labels;
const factLabel = labels.facts ?? "事实";
```

Use `profile.quickActions` for quick action buttons.

Use `state.knownFacts`, `state.resources`, `state.relationships`, and `state.objectiveStages`.

- [ ] **Step 5: Update turn message type handling**

Change `clue` to `fact`:

```ts
type TurnMessage = {
  type: "environment" | "narration" | "character" | "system" | "item" | "fact";
  characterId?: string;
  itemId?: string;
  factId?: string;
};
```

Label fact messages with `profile.labels.facts`.

- [ ] **Step 6: Run Web tests**

Run:

```bash
npm test -- apps/web/src/components/GameShell.test.tsx apps/web/app/api/session/route.test.ts
npm run web:build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/api/session/route.ts apps/web/app/api/session/route.test.ts apps/web/src/components/GameShell.tsx apps/web/src/components/GameShell.test.tsx apps/web/tests/player.spec.ts
git commit -m "feat: drive web UI from pack profiles"
```

---

### Task 12: Docs, Full Verification, and Core Terminology Audit

**Files:**
- Modify: `README.md`
- Modify tests only if full-suite failures expose stale names.

- [ ] **Step 1: Update README**

Replace detective-only description with:

```md
This repository contains a TypeScript MVP for importable AI interactive world packs. The v0.2 runtime uses generic facts, resources, relationships, objectives, and data-driven genre profiles so packs can cover detective mystery, cultivation, romance, tabletop fantasy, and other story genres.
```

Update commands:

```bash
npm run cli -- validate packs/campus-lunch
npm run cli -- simulate packs/campus-lunch packs/campus-lunch/scripts/honest-path.yaml
npm run cli -- facts <sessionId>
```

- [ ] **Step 2: Run full unit tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`

Expected: PASS.

- [ ] **Step 4: Validate every pack**

Run:

```bash
npm run cli -- validate packs/campus-lunch
npm run cli -- validate packs/cave-breakthrough
npm run cli -- validate packs/rain-tower
npm run cli -- validate packs/ember-crypt
npm run cli -- validate packs/mist-sect
npm run cli -- validate packs/spring-festival
```

Expected: every command prints `Pack valid: <pack-id>`.

- [ ] **Step 5: Simulate every pack script**

Run:

```bash
npm run cli -- simulate packs/campus-lunch packs/campus-lunch/scripts/honest-path.yaml
npm run cli -- simulate packs/cave-breakthrough packs/cave-breakthrough/scripts/clear-path.yaml
npm run cli -- simulate packs/rain-tower packs/rain-tower/scripts/true-path.yaml
npm run cli -- simulate packs/rain-tower packs/rain-tower/scripts/wrong-accusation.yaml
npm run cli -- simulate packs/ember-crypt packs/ember-crypt/scripts/vault-path.yaml
npm run cli -- simulate packs/mist-sect packs/mist-sect/scripts/orthodox-path.yaml
npm run cli -- simulate packs/spring-festival packs/spring-festival/scripts/festival-path.yaml
```

Expected: every command prints `Simulation completed`.

- [ ] **Step 6: Run Web verification**

Run:

```bash
npm run web:build
npm run e2e
```

Expected: PASS.

- [ ] **Step 7: Audit terminology**

Run:

```bash
rg -n "clue|Clue|accuse|Accuse|murder|Murder|case|Case|npc|Npc|quest|Quest|knownClues|discover_clue|knows_clue|quest_stage_is" packages apps README.md
```

Expected: no matches in generic core code. Accept matches only in:

- `packs/rain-tower`
- `docs/superpowers`
- user-facing detective profile content
- migration comments that explicitly explain v0.1 to v0.2 naming

- [ ] **Step 8: Commit final cleanup**

```bash
git add README.md packages apps packs
git commit -m "docs: document generic genre runtime"
```

---

## Plan Self-Review

- Spec coverage: the plan covers schema, rules, triggers, loader, validator, action parsing, runtime, agents, CLI, Web UI, all six packs, validation, simulation, and terminology audit.
- Scope control: this remains one breaking v0.2 migration because old compatibility is intentionally excluded.
- Test order: every implementation task starts with focused failing tests, then implementation, then focused passing tests.
- Risk point: pack authoring is the largest content task. Keep each pack mechanically small enough to validate first, then improve prose after tests pass.


# AI Interactive Game MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable single-player MVP for an importable AI detective world-pack runtime with Web play, CLI debugging, rule-checked state patches, scoped NPC actors, and event traces.

**Architecture:** Use a TypeScript monorepo with shared domain types, pack loading, rules, memory, agents, persistence, runtime, CLI, and Web packages. The Director is a programmatic orchestrator; Narrator and NPC Actor calls go through scoped contexts and cannot directly mutate authoritative state. All state changes pass through patch validation and are persisted in SQLite-backed sessions with replayable event logs.

**Tech Stack:** TypeScript, npm workspaces, Zod, YAML, Vitest, MiniSearch, Commander, better-sqlite3, Next.js, React, Playwright, tsx.

---

## Scope Boundary

This plan implements the approved MVP only:

- One detective sample pack named `rain-tower`.
- Single-player sessions.
- Web player UI.
- CLI validation, play, state, clues, trace, and simulation commands.
- Programmatic Director Orchestrator.
- Scoped Narrator and NPC Actor model calls.
- SQLite persistence.
- BM25-style pack text retrieval via MiniSearch.
- Deterministic fake model provider for tests and local simulation.
- OpenAI-compatible cloud provider behind the same model interface.

This plan does not build multiplayer, a public pack marketplace, visual pack editing, complex combat, autonomous NPC schedules, voice, images, or vector retrieval.

## Target File Structure

```text
.
  package.json
  package-lock.json
  tsconfig.base.json
  vitest.config.ts
  playwright.config.ts
  .gitignore
  apps/
    cli/
      package.json
      src/main.ts
      src/main.test.ts
    web/
      package.json
      next.config.mjs
      tsconfig.json
      app/
        api/turn/route.ts
        api/session/route.ts
        page.tsx
        layout.tsx
        globals.css
      src/components/GameShell.tsx
      src/components/GameShell.test.tsx
      src/server/sessionStore.ts
      tests/player.spec.ts
  packages/
    shared/
      package.json
      src/domain.ts
      src/domain.test.ts
      src/index.ts
    pack/
      package.json
      src/loadPack.ts
      src/loadPack.test.ts
      src/validatePack.ts
      src/validatePack.test.ts
      src/index.ts
    rules/
      package.json
      src/conditions.ts
      src/conditions.test.ts
      src/patches.ts
      src/patches.test.ts
      src/endings.ts
      src/endings.test.ts
      src/index.ts
    memory/
      package.json
      src/packIndex.ts
      src/packIndex.test.ts
      src/index.ts
    persistence/
      package.json
      src/sqliteStore.ts
      src/sqliteStore.test.ts
      src/index.ts
    agents/
      package.json
      src/modelProvider.ts
      src/fakeProvider.ts
      src/cloudProvider.ts
      src/contexts.ts
      src/contexts.test.ts
      src/auditor.ts
      src/auditor.test.ts
      src/index.ts
    runtime/
      package.json
      src/actionParser.ts
      src/actionParser.test.ts
      src/orchestrator.ts
      src/orchestrator.test.ts
      src/simulator.ts
      src/simulator.test.ts
      src/index.ts
  packs/
    rain-tower/
      manifest.yaml
      world.md
      rules.yaml
      locations.yaml
      npcs.yaml
      clues.yaml
      items.yaml
      quests.yaml
      endings.yaml
      prompts/narrator.md
      prompts/npc.md
      prompts/auditor.md
      scripts/true-path.yaml
      scripts/wrong-accusation.yaml
```

## Shared Naming

Use these package names in every `package.json`:

- `@aigame/shared`
- `@aigame/pack`
- `@aigame/rules`
- `@aigame/memory`
- `@aigame/persistence`
- `@aigame/agents`
- `@aigame/runtime`
- `@aigame/cli`
- `@aigame/web`

Use these core IDs in tests and the sample pack:

- Pack ID: `rain-tower`
- Entry location: `foyer`
- NPC IDs: `butler`, `gardener`, `heiress`
- Clue IDs: `broken_watch`, `muddy_bootprint`, `torn_letter`, `greenhouse_key`, `tower_bell_record`, `false_alibi`
- Item IDs: `greenhouse_key`, `silver_watch`
- Quest ID: `solve_murder`
- Ending IDs: `true_resolution`, `wrong_accusation`, `unresolved_failure`

---

### Task 1: Workspace Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `.gitignore`
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/src/smoke.test.ts`

- [x] **Step 1: Create root workspace files**

Create `package.json`:

```json
{
  "name": "ai-interactive-game",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "tsc --noEmit -p tsconfig.base.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit -p tsconfig.base.json --pretty false",
    "cli": "tsx apps/cli/src/main.ts",
    "web:dev": "next dev apps/web",
    "web:build": "next build apps/web",
    "e2e": "playwright test"
  }
}
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "baseUrl": ".",
    "paths": {
      "@aigame/shared": ["packages/shared/src/index.ts"],
      "@aigame/pack": ["packages/pack/src/index.ts"],
      "@aigame/rules": ["packages/rules/src/index.ts"],
      "@aigame/memory": ["packages/memory/src/index.ts"],
      "@aigame/persistence": ["packages/persistence/src/index.ts"],
      "@aigame/agents": ["packages/agents/src/index.ts"],
      "@aigame/runtime": ["packages/runtime/src/index.ts"]
    }
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "apps/**/*.test.tsx"],
    environment: "node"
  },
  resolve: {
    alias: {
      "@aigame/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
      "@aigame/pack": fileURLToPath(new URL("./packages/pack/src/index.ts", import.meta.url)),
      "@aigame/rules": fileURLToPath(new URL("./packages/rules/src/index.ts", import.meta.url)),
      "@aigame/memory": fileURLToPath(new URL("./packages/memory/src/index.ts", import.meta.url)),
      "@aigame/persistence": fileURLToPath(new URL("./packages/persistence/src/index.ts", import.meta.url)),
      "@aigame/agents": fileURLToPath(new URL("./packages/agents/src/index.ts", import.meta.url)),
      "@aigame/runtime": fileURLToPath(new URL("./packages/runtime/src/index.ts", import.meta.url))
    }
  }
});
```

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "apps/web/tests",
  webServer: {
    command: "npm run web:dev",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: true,
    timeout: 120000
  },
  use: {
    baseURL: "http://127.0.0.1:3000"
  }
});
```

Create `.gitignore`:

```gitignore
node_modules/
.next/
dist/
coverage/
.env
.env.local
*.db
*.db-shm
*.db-wal
playwright-report/
test-results/
```

- [x] **Step 2: Create shared package smoke test**

Create `packages/shared/package.json`:

```json
{
  "name": "@aigame/shared",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Create `packages/shared/src/index.ts`:

```ts
export const workspaceReady = true;
```

Create `packages/shared/src/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { workspaceReady } from "./index";

describe("workspace", () => {
  it("loads TypeScript workspace modules", () => {
    expect(workspaceReady).toBe(true);
  });
});
```

- [x] **Step 3: Install dependencies**

Run:

```bash
npm install -D typescript vitest tsx @types/node @playwright/test @testing-library/react @testing-library/jest-dom jsdom
npm install zod yaml minisearch commander better-sqlite3 next react react-dom
npm install -D @types/better-sqlite3 @types/react @types/react-dom
```

Expected: `package-lock.json` exists and `node_modules` exists.

- [x] **Step 4: Run smoke test**

Run:

```bash
npm test -- --run packages/shared/src/smoke.test.ts
```

Expected: PASS with one test.

- [x] **Step 5: Commit scaffold**

```bash
git add package.json package-lock.json tsconfig.base.json vitest.config.ts playwright.config.ts .gitignore packages/shared
git commit -m "chore: scaffold TypeScript workspace"
```

---

### Task 2: Shared Domain Types And Schemas

**Files:**
- Replace: `packages/shared/src/index.ts`
- Create: `packages/shared/src/domain.ts`
- Create: `packages/shared/src/domain.test.ts`

- [x] **Step 1: Write shared domain tests**

Create `packages/shared/src/domain.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ActionSchema,
  ConditionSchema,
  PatchSchema,
  SessionStateSchema,
  WorldPackSchema
} from "./domain";

describe("domain schemas", () => {
  it("accepts a valid inspect action", () => {
    const action = ActionSchema.parse({
      type: "inspect",
      targetId: "window",
      rawText: "inspect window"
    });

    expect(action.type).toBe("inspect");
  });

  it("accepts nested all conditions", () => {
    const condition = ConditionSchema.parse({
      all: [{ location_is: "greenhouse" }, { flag_true: "rain_started" }]
    });

    expect("all" in condition).toBe(true);
  });

  it("rejects unknown patch types", () => {
    expect(() =>
      PatchSchema.parse({ type: "rewrite_truth", clueId: "broken_watch" })
    ).toThrow();
  });

  it("accepts the minimum session state", () => {
    const state = SessionStateSchema.parse({
      currentLocationId: "foyer",
      turn: 0,
      inventory: [],
      knownClues: [],
      flags: {},
      npcAttitudes: {},
      questStages: {}
    });

    expect(state.currentLocationId).toBe("foyer");
  });

  it("accepts a small pack object", () => {
    const pack = WorldPackSchema.parse({
      manifest: {
        id: "rain-tower",
        name: "Rain Tower Murder",
        version: "0.1.0",
        runtimeVersion: "0.1.0",
        entryLocationId: "foyer"
      },
      worldText: "A locked-room mystery.",
      rules: { allowedPatchTypes: ["discover_clue", "set_flag"] },
      locations: [{ id: "foyer", name: "Foyer", description: "A cold entry hall.", exits: [] }],
      npcs: [],
      clues: [],
      items: [],
      quests: [],
      endings: [],
      prompts: {}
    });

    expect(pack.manifest.id).toBe("rain-tower");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- --run packages/shared/src/domain.test.ts
```

Expected: FAIL because `./domain` does not exist.

- [x] **Step 3: Add domain schemas**

Create `packages/shared/src/domain.ts` with these exports:

```ts
import { z } from "zod";

export const IdSchema = z.string().regex(/^[a-z][a-z0-9_:-]*$/);

export const ManifestSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  runtimeVersion: z.string().min(1),
  entryLocationId: IdSchema
});

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionSchema).min(1) }),
    z.object({ any: z.array(ConditionSchema).min(1) }),
    z.object({ not: ConditionSchema }),
    z.object({ location_is: IdSchema }),
    z.object({ flag_true: IdSchema }),
    z.object({ has_item: IdSchema }),
    z.object({ knows_clue: IdSchema }),
    z.object({ quest_stage_is: z.object({ quest: IdSchema, stage: z.string().min(1) }) }),
    z.object({ npc_attitude_at_least: z.object({ npc: IdSchema, value: z.number().int() }) })
  ])
);

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { location_is: string }
  | { flag_true: string }
  | { has_item: string }
  | { knows_clue: string }
  | { quest_stage_is: { quest: string; stage: string } }
  | { npc_attitude_at_least: { npc: string; value: number } };

export const LocationSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  exits: z.array(IdSchema),
  entryCondition: ConditionSchema.optional(),
  visibleObjects: z.array(IdSchema).default([])
});

export const NpcSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  publicDescription: z.string().min(1),
  privateFacts: z.array(z.string()).default([]),
  knows: z.array(z.string()).default([]),
  forbiddenDisclosures: z.array(z.string()).default([]),
  topics: z
    .array(
      z.object({
        id: IdSchema,
        prompt: z.string().min(1),
        unlockCondition: ConditionSchema.optional(),
        revealsClueId: IdSchema.optional()
      })
    )
    .default([])
});

export const ClueSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  discoverableWhen: ConditionSchema.optional(),
  accusationWeight: z.number().int().min(0).default(0)
});

export const ItemSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  pickupCondition: ConditionSchema.optional()
});

export const QuestSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  stages: z.array(z.string().min(1)).min(1),
  initialStage: z.string().min(1)
});

export const EndingSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  priority: z.number().int(),
  condition: ConditionSchema,
  text: z.string().min(1)
});

export const RulesSchema = z.object({
  allowedPatchTypes: z.array(z.string()).min(1)
});

export const WorldPackSchema = z.object({
  manifest: ManifestSchema,
  worldText: z.string(),
  rules: RulesSchema,
  locations: z.array(LocationSchema),
  npcs: z.array(NpcSchema),
  clues: z.array(ClueSchema),
  items: z.array(ItemSchema),
  quests: z.array(QuestSchema),
  endings: z.array(EndingSchema),
  prompts: z.record(z.string(), z.string()).default({})
});

export const SessionStateSchema = z.object({
  currentLocationId: IdSchema,
  turn: z.number().int().min(0),
  inventory: z.array(IdSchema),
  knownClues: z.array(IdSchema),
  flags: z.record(z.string(), z.boolean()),
  npcAttitudes: z.record(z.string(), z.number().int()),
  questStages: z.record(z.string(), z.string())
});

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("look"), rawText: z.string() }),
  z.object({ type: z.literal("inspect"), targetId: IdSchema, rawText: z.string() }),
  z.object({ type: z.literal("move"), locationId: IdSchema, rawText: z.string() }),
  z.object({ type: z.literal("ask"), npcId: IdSchema, topic: z.string().min(1), rawText: z.string() }),
  z.object({ type: z.literal("use"), itemId: IdSchema, targetId: IdSchema.optional(), rawText: z.string() }),
  z.object({ type: z.literal("accuse"), npcId: IdSchema, clueIds: z.array(IdSchema), rawText: z.string() }),
  z.object({ type: z.literal("unknown"), rawText: z.string() })
]);

export const PatchSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("discover_clue"), clueId: IdSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal("add_item"), itemId: IdSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal("remove_item"), itemId: IdSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal("move_location"), locationId: IdSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal("set_flag"), flag: IdSchema, value: z.boolean(), reason: z.string().min(1) }),
  z.object({ type: z.literal("adjust_npc_attitude"), npcId: IdSchema, delta: z.number().int(), reason: z.string().min(1) }),
  z.object({ type: z.literal("set_quest_stage"), questId: IdSchema, stage: z.string().min(1), reason: z.string().min(1) })
]);

export type Manifest = z.infer<typeof ManifestSchema>;
export type WorldPack = z.infer<typeof WorldPackSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type GameAction = z.infer<typeof ActionSchema>;
export type GamePatch = z.infer<typeof PatchSchema>;
export type LocationDef = z.infer<typeof LocationSchema>;
export type NpcDef = z.infer<typeof NpcSchema>;
export type ClueDef = z.infer<typeof ClueSchema>;
export type EndingDef = z.infer<typeof EndingSchema>;
```

Replace `packages/shared/src/index.ts`:

```ts
export * from "./domain";
```

- [x] **Step 4: Run domain tests**

Run:

```bash
npm test -- --run packages/shared/src/domain.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit shared domain**

```bash
git add packages/shared/src/domain.ts packages/shared/src/domain.test.ts packages/shared/src/index.ts
git commit -m "feat: add shared game domain schemas"
```

---

### Task 3: World Pack Loader

**Files:**
- Create: `packages/pack/package.json`
- Create: `packages/pack/src/loadPack.ts`
- Create: `packages/pack/src/loadPack.test.ts`
- Create: `packages/pack/src/index.ts`

- [x] **Step 1: Write loader tests**

Create `packages/pack/src/loadPack.test.ts`:

```ts
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadWorldPack } from "./loadPack";

function writeMiniPack(root: string) {
  writeFileSync(join(root, "manifest.yaml"), [
    "id: rain-tower",
    "name: Rain Tower Murder",
    "version: 0.1.0",
    "runtimeVersion: 0.1.0",
    "entryLocationId: foyer"
  ].join("\n"));
  writeFileSync(join(root, "world.md"), "A locked-room mystery.");
  writeFileSync(join(root, "rules.yaml"), "allowedPatchTypes:\n  - discover_clue\n  - set_flag\n");
  writeFileSync(join(root, "locations.yaml"), "- id: foyer\n  name: Foyer\n  description: A cold entry hall.\n  exits: []\n");
  writeFileSync(join(root, "npcs.yaml"), "[]\n");
  writeFileSync(join(root, "clues.yaml"), "[]\n");
  writeFileSync(join(root, "items.yaml"), "[]\n");
  writeFileSync(join(root, "quests.yaml"), "[]\n");
  writeFileSync(join(root, "endings.yaml"), "[]\n");
  mkdirSync(join(root, "prompts"));
  writeFileSync(join(root, "prompts", "narrator.md"), "Narrate only visible facts.");
}

describe("loadWorldPack", () => {
  it("loads a directory world pack", () => {
    const root = mkdtempSync(join(tmpdir(), "pack-"));
    writeMiniPack(root);

    const pack = loadWorldPack(root);

    expect(pack.manifest.id).toBe("rain-tower");
    expect(pack.worldText).toContain("locked-room");
    expect(pack.locations[0]?.id).toBe("foyer");
    expect(pack.prompts.narrator).toContain("visible facts");
  });

  it("reports the missing pack file path", () => {
    const root = mkdtempSync(join(tmpdir(), "pack-"));

    expect(() => loadWorldPack(root)).toThrow(/manifest.yaml/);
  });
});
```

- [x] **Step 2: Run loader tests to verify failure**

Run:

```bash
npm test -- --run packages/pack/src/loadPack.test.ts
```

Expected: FAIL because `./loadPack` does not exist.

- [x] **Step 3: Add loader implementation**

Create `packages/pack/package.json`:

```json
{
  "name": "@aigame/pack",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@aigame/shared": "*"
  }
}
```

Create `packages/pack/src/loadPack.ts`:

```ts
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";
import { WorldPack, WorldPackSchema } from "@aigame/shared";

function readRequiredFile(root: string, fileName: string): string {
  const path = join(root, fileName);
  if (!existsSync(path)) {
    throw new Error(`Missing required pack file: ${fileName}`);
  }
  return readFileSync(path, "utf8");
}

function parseYamlFile(root: string, fileName: string): unknown {
  return YAML.parse(readRequiredFile(root, fileName));
}

function readPrompts(root: string): Record<string, string> {
  const promptsDir = join(root, "prompts");
  if (!existsSync(promptsDir)) {
    return {};
  }

  return Object.fromEntries(
    readdirSync(promptsDir)
      .filter((fileName) => fileName.endsWith(".md"))
      .map((fileName) => [
        fileName.replace(/\.md$/, ""),
        readFileSync(join(promptsDir, fileName), "utf8")
      ])
  );
}

export function loadWorldPack(root: string): WorldPack {
  const rawPack = {
    manifest: parseYamlFile(root, "manifest.yaml"),
    worldText: readRequiredFile(root, "world.md"),
    rules: parseYamlFile(root, "rules.yaml"),
    locations: parseYamlFile(root, "locations.yaml"),
    npcs: parseYamlFile(root, "npcs.yaml"),
    clues: parseYamlFile(root, "clues.yaml"),
    items: parseYamlFile(root, "items.yaml"),
    quests: parseYamlFile(root, "quests.yaml"),
    endings: parseYamlFile(root, "endings.yaml"),
    prompts: readPrompts(root)
  };

  return WorldPackSchema.parse(rawPack);
}
```

Create `packages/pack/src/index.ts`:

```ts
export * from "./loadPack";
```

- [x] **Step 4: Run loader tests**

Run:

```bash
npm test -- --run packages/pack/src/loadPack.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit loader**

```bash
git add packages/pack
git commit -m "feat: load directory world packs"
```

---

### Task 4: World Pack Validator

**Files:**
- Modify: `packages/pack/src/index.ts`
- Create: `packages/pack/src/validatePack.ts`
- Create: `packages/pack/src/validatePack.test.ts`

- [x] **Step 1: Write validator tests**

Create `packages/pack/src/validatePack.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { WorldPack } from "@aigame/shared";
import { validateWorldPack } from "./validatePack";

function basePack(): WorldPack {
  return {
    manifest: {
      id: "rain-tower",
      name: "Rain Tower Murder",
      version: "0.1.0",
      runtimeVersion: "0.1.0",
      entryLocationId: "foyer"
    },
    worldText: "A mystery.",
    rules: { allowedPatchTypes: ["discover_clue", "set_flag"] },
    locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: [], visibleObjects: [] }],
    npcs: [{ id: "butler", name: "Butler", publicDescription: "Formal.", privateFacts: [], knows: [], forbiddenDisclosures: [], topics: [] }],
    clues: [{ id: "broken_watch", name: "Broken watch", description: "Stopped at nine.", accusationWeight: 2 }],
    items: [],
    quests: [{ id: "solve_murder", name: "Solve murder", stages: ["investigate", "accuse"], initialStage: "investigate" }],
    endings: [{ id: "unresolved_failure", name: "Unresolved", priority: 0, condition: { flag_true: "case_failed" }, text: "The case goes cold." }],
    prompts: {}
  };
}

describe("validateWorldPack", () => {
  it("accepts a coherent pack", () => {
    const result = validateWorldPack(basePack());

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("reports missing entry location", () => {
    const pack = basePack();
    pack.manifest.entryLocationId = "missing";

    const result = validateWorldPack(pack);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Entry location not found: missing");
  });

  it("reports broken location exits", () => {
    const pack = basePack();
    pack.locations[0]!.exits = ["study"];

    const result = validateWorldPack(pack);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Location foyer exits to missing location: study");
  });

  it("reports NPC topic clue references", () => {
    const pack = basePack();
    pack.locations[0]!.exits = [];
    pack.npcs[0]!.topics = [{ id: "alibi", prompt: "Ask alibi.", revealsClueId: "missing_clue" }];

    const result = validateWorldPack(pack);

    expect(result.errors).toContain("NPC butler topic alibi reveals missing clue: missing_clue");
  });
});
```

- [x] **Step 2: Run validator tests to verify failure**

Run:

```bash
npm test -- --run packages/pack/src/validatePack.test.ts
```

Expected: FAIL because `./validatePack` does not exist.

- [x] **Step 3: Add validator implementation**

Create `packages/pack/src/validatePack.ts`:

```ts
import { WorldPack } from "@aigame/shared";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateWorldPack(pack: WorldPack): ValidationResult {
  const errors: string[] = [];
  const locationIds = new Set(pack.locations.map((location) => location.id));
  const clueIds = new Set(pack.clues.map((clue) => clue.id));
  const questIds = new Set(pack.quests.map((quest) => quest.id));

  if (!locationIds.has(pack.manifest.entryLocationId)) {
    errors.push(`Entry location not found: ${pack.manifest.entryLocationId}`);
  }

  for (const location of pack.locations) {
    for (const exitId of location.exits) {
      if (!locationIds.has(exitId)) {
        errors.push(`Location ${location.id} exits to missing location: ${exitId}`);
      }
    }
  }

  for (const npc of pack.npcs) {
    for (const topic of npc.topics) {
      if (topic.revealsClueId && !clueIds.has(topic.revealsClueId)) {
        errors.push(`NPC ${npc.id} topic ${topic.id} reveals missing clue: ${topic.revealsClueId}`);
      }
    }
  }

  for (const quest of pack.quests) {
    if (!quest.stages.includes(quest.initialStage)) {
      errors.push(`Quest ${quest.id} initial stage is not in stages: ${quest.initialStage}`);
    }
  }

  for (const ending of pack.endings) {
    collectConditionReferences(ending.condition).questIds.forEach((questId) => {
      if (!questIds.has(questId)) {
        errors.push(`Ending ${ending.id} references missing quest: ${questId}`);
      }
    });
  }

  return { ok: errors.length === 0, errors };
}

function collectConditionReferences(condition: unknown): { questIds: Set<string> } {
  const questIds = new Set<string>();

  function visit(node: unknown): void {
    if (!node || typeof node !== "object") {
      return;
    }

    if ("quest_stage_is" in node) {
      const value = (node as { quest_stage_is?: { quest?: string } }).quest_stage_is;
      if (value?.quest) {
        questIds.add(value.quest);
      }
    }

    if ("all" in node) {
      for (const child of (node as { all: unknown[] }).all) visit(child);
    }

    if ("any" in node) {
      for (const child of (node as { any: unknown[] }).any) visit(child);
    }

    if ("not" in node) {
      visit((node as { not: unknown }).not);
    }
  }

  visit(condition);
  return { questIds };
}
```

Replace `packages/pack/src/index.ts`:

```ts
export * from "./loadPack";
export * from "./validatePack";
```

- [x] **Step 4: Run validator tests**

Run:

```bash
npm test -- --run packages/pack/src/validatePack.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit validator**

```bash
git add packages/pack/src/validatePack.ts packages/pack/src/validatePack.test.ts packages/pack/src/index.ts
git commit -m "feat: validate world pack references"
```

---

### Task 5: Rule Conditions

**Files:**
- Create: `packages/rules/package.json`
- Create: `packages/rules/src/conditions.ts`
- Create: `packages/rules/src/conditions.test.ts`
- Create: `packages/rules/src/index.ts`

- [x] **Step 1: Write condition evaluator tests**

Create `packages/rules/src/conditions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SessionState } from "@aigame/shared";
import { evaluateCondition } from "./conditions";

const state: SessionState = {
  currentLocationId: "greenhouse",
  turn: 3,
  inventory: ["greenhouse_key"],
  knownClues: ["muddy_bootprint"],
  flags: { rain_started: true },
  npcAttitudes: { gardener: 2 },
  questStages: { solve_murder: "investigate" }
};

describe("evaluateCondition", () => {
  it("evaluates primitive conditions", () => {
    expect(evaluateCondition({ location_is: "greenhouse" }, state)).toBe(true);
    expect(evaluateCondition({ has_item: "greenhouse_key" }, state)).toBe(true);
    expect(evaluateCondition({ knows_clue: "muddy_bootprint" }, state)).toBe(true);
    expect(evaluateCondition({ flag_true: "rain_started" }, state)).toBe(true);
  });

  it("evaluates nested conditions", () => {
    expect(
      evaluateCondition(
        { all: [{ location_is: "greenhouse" }, { npc_attitude_at_least: { npc: "gardener", value: 2 } }] },
        state
      )
    ).toBe(true);

    expect(evaluateCondition({ not: { has_item: "silver_watch" } }, state)).toBe(true);
  });

  it("evaluates quest stages", () => {
    expect(evaluateCondition({ quest_stage_is: { quest: "solve_murder", stage: "investigate" } }, state)).toBe(true);
  });
});
```

- [x] **Step 2: Run condition tests to verify failure**

Run:

```bash
npm test -- --run packages/rules/src/conditions.test.ts
```

Expected: FAIL because `./conditions` does not exist.

- [x] **Step 3: Add condition evaluator**

Create `packages/rules/package.json`:

```json
{
  "name": "@aigame/rules",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@aigame/shared": "*"
  }
}
```

Create `packages/rules/src/conditions.ts`:

```ts
import { Condition, SessionState } from "@aigame/shared";

export function evaluateCondition(condition: Condition | undefined, state: SessionState): boolean {
  if (!condition) {
    return true;
  }

  if ("all" in condition) {
    return condition.all.every((child) => evaluateCondition(child, state));
  }

  if ("any" in condition) {
    return condition.any.some((child) => evaluateCondition(child, state));
  }

  if ("not" in condition) {
    return !evaluateCondition(condition.not, state);
  }

  if ("location_is" in condition) {
    return state.currentLocationId === condition.location_is;
  }

  if ("flag_true" in condition) {
    return state.flags[condition.flag_true] === true;
  }

  if ("has_item" in condition) {
    return state.inventory.includes(condition.has_item);
  }

  if ("knows_clue" in condition) {
    return state.knownClues.includes(condition.knows_clue);
  }

  if ("quest_stage_is" in condition) {
    return state.questStages[condition.quest_stage_is.quest] === condition.quest_stage_is.stage;
  }

  if ("npc_attitude_at_least" in condition) {
    const actual = state.npcAttitudes[condition.npc_attitude_at_least.npc] ?? 0;
    return actual >= condition.npc_attitude_at_least.value;
  }

  return false;
}
```

Create `packages/rules/src/index.ts`:

```ts
export * from "./conditions";
```

- [x] **Step 4: Run condition tests**

Run:

```bash
npm test -- --run packages/rules/src/conditions.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit conditions**

```bash
git add packages/rules
git commit -m "feat: evaluate rule conditions"
```

---

### Task 6: Patch Validation And Ending Judgment

**Files:**
- Modify: `packages/rules/src/index.ts`
- Create: `packages/rules/src/patches.ts`
- Create: `packages/rules/src/patches.test.ts`
- Create: `packages/rules/src/endings.ts`
- Create: `packages/rules/src/endings.test.ts`

- [x] **Step 1: Write patch tests**

Create `packages/rules/src/patches.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SessionState, WorldPack } from "@aigame/shared";
import { applyAcceptedPatch, validatePatch } from "./patches";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Murder", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "foyer" },
  worldText: "",
  rules: { allowedPatchTypes: ["discover_clue", "move_location", "set_flag"] },
  locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: [] }, { id: "study", name: "Study", description: "Books.", exits: [], visibleObjects: [] }],
  npcs: [],
  clues: [{ id: "broken_watch", name: "Broken watch", description: "Stopped.", accusationWeight: 2 }],
  items: [],
  quests: [],
  endings: [],
  prompts: {}
};

const state: SessionState = {
  currentLocationId: "foyer",
  turn: 0,
  inventory: [],
  knownClues: [],
  flags: {},
  npcAttitudes: {},
  questStages: {}
};

describe("patch validation", () => {
  it("accepts existing clue discovery", () => {
    const result = validatePatch({ type: "discover_clue", clueId: "broken_watch", reason: "Found on desk." }, pack, state);
    expect(result.ok).toBe(true);
  });

  it("rejects unknown clue discovery", () => {
    const result = validatePatch({ type: "discover_clue", clueId: "invented", reason: "AI guessed." }, pack, state);
    expect(result).toEqual({ ok: false, reason: "Unknown clue: invented" });
  });

  it("moves only to valid connected locations", () => {
    const moved = applyAcceptedPatch({ type: "move_location", locationId: "study", reason: "Walked east." }, state);
    expect(moved.currentLocationId).toBe("study");
  });
});
```

- [x] **Step 2: Write ending tests**

Create `packages/rules/src/endings.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SessionState, WorldPack } from "@aigame/shared";
import { judgeEnding } from "./endings";

const state: SessionState = {
  currentLocationId: "foyer",
  turn: 8,
  inventory: [],
  knownClues: ["broken_watch", "muddy_bootprint"],
  flags: { accused_butler: true },
  npcAttitudes: {},
  questStages: { solve_murder: "accuse" }
};

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Murder", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "foyer" },
  worldText: "",
  rules: { allowedPatchTypes: ["set_flag"] },
  locations: [],
  npcs: [],
  clues: [],
  items: [],
  quests: [],
  endings: [
    { id: "wrong_accusation", name: "Wrong", priority: 1, condition: { flag_true: "wrong_accusation" }, text: "The truth slips away." },
    { id: "true_resolution", name: "True", priority: 10, condition: { all: [{ flag_true: "accused_butler" }, { knows_clue: "broken_watch" }, { knows_clue: "muddy_bootprint" }] }, text: "The butler confesses." }
  ],
  prompts: {}
};

describe("judgeEnding", () => {
  it("selects the highest-priority satisfied ending", () => {
    expect(judgeEnding(pack, state)?.id).toBe("true_resolution");
  });

  it("returns undefined when no ending matches", () => {
    expect(judgeEnding({ ...pack, endings: [] }, state)).toBeUndefined();
  });
});
```

- [x] **Step 3: Run tests to verify failure**

Run:

```bash
npm test -- --run packages/rules/src/patches.test.ts packages/rules/src/endings.test.ts
```

Expected: FAIL because `./patches` and `./endings` do not exist.

- [x] **Step 4: Add patch implementation**

Create `packages/rules/src/patches.ts`:

```ts
import { GamePatch, SessionState, WorldPack } from "@aigame/shared";
import { evaluateCondition } from "./conditions";

export type PatchValidation = { ok: true } | { ok: false; reason: string };

export function validatePatch(patch: GamePatch, pack: WorldPack, state: SessionState): PatchValidation {
  if (!pack.rules.allowedPatchTypes.includes(patch.type)) {
    return { ok: false, reason: `Patch type not allowed: ${patch.type}` };
  }

  if (patch.type === "discover_clue") {
    const clue = pack.clues.find((candidate) => candidate.id === patch.clueId);
    if (!clue) {
      return { ok: false, reason: `Unknown clue: ${patch.clueId}` };
    }
    if (!evaluateCondition(clue.discoverableWhen, state)) {
      return { ok: false, reason: `Clue discovery condition failed: ${patch.clueId}` };
    }
  }

  if (patch.type === "move_location") {
    const current = pack.locations.find((location) => location.id === state.currentLocationId);
    if (!current?.exits.includes(patch.locationId)) {
      return { ok: false, reason: `Location is not reachable: ${patch.locationId}` };
    }
  }

  return { ok: true };
}

export function applyAcceptedPatch(patch: GamePatch, state: SessionState): SessionState {
  const next: SessionState = {
    ...state,
    inventory: [...state.inventory],
    knownClues: [...state.knownClues],
    flags: { ...state.flags },
    npcAttitudes: { ...state.npcAttitudes },
    questStages: { ...state.questStages }
  };

  if (patch.type === "discover_clue" && !next.knownClues.includes(patch.clueId)) {
    next.knownClues.push(patch.clueId);
  }

  if (patch.type === "add_item" && !next.inventory.includes(patch.itemId)) {
    next.inventory.push(patch.itemId);
  }

  if (patch.type === "remove_item") {
    next.inventory = next.inventory.filter((itemId) => itemId !== patch.itemId);
  }

  if (patch.type === "move_location") {
    next.currentLocationId = patch.locationId;
  }

  if (patch.type === "set_flag") {
    next.flags[patch.flag] = patch.value;
  }

  if (patch.type === "adjust_npc_attitude") {
    next.npcAttitudes[patch.npcId] = (next.npcAttitudes[patch.npcId] ?? 0) + patch.delta;
  }

  if (patch.type === "set_quest_stage") {
    next.questStages[patch.questId] = patch.stage;
  }

  return next;
}
```

- [x] **Step 5: Add ending implementation**

Create `packages/rules/src/endings.ts`:

```ts
import { EndingDef, SessionState, WorldPack } from "@aigame/shared";
import { evaluateCondition } from "./conditions";

export function judgeEnding(pack: WorldPack, state: SessionState): EndingDef | undefined {
  return [...pack.endings]
    .filter((ending) => evaluateCondition(ending.condition, state))
    .sort((left, right) => right.priority - left.priority)[0];
}
```

Replace `packages/rules/src/index.ts`:

```ts
export * from "./conditions";
export * from "./patches";
export * from "./endings";
```

- [x] **Step 6: Run rule tests**

Run:

```bash
npm test -- --run packages/rules/src/conditions.test.ts packages/rules/src/patches.test.ts packages/rules/src/endings.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit rule patching and endings**

```bash
git add packages/rules/src
git commit -m "feat: validate patches and judge endings"
```

---

### Task 7: Rain Tower Sample Pack

**Files:**
- Create: `packs/rain-tower/manifest.yaml`
- Create: `packs/rain-tower/world.md`
- Create: `packs/rain-tower/rules.yaml`
- Create: `packs/rain-tower/locations.yaml`
- Create: `packs/rain-tower/npcs.yaml`
- Create: `packs/rain-tower/clues.yaml`
- Create: `packs/rain-tower/items.yaml`
- Create: `packs/rain-tower/quests.yaml`
- Create: `packs/rain-tower/endings.yaml`
- Create: `packs/rain-tower/prompts/narrator.md`
- Create: `packs/rain-tower/prompts/npc.md`
- Create: `packs/rain-tower/prompts/auditor.md`
- Create: `packs/rain-tower/scripts/true-path.yaml`
- Create: `packs/rain-tower/scripts/wrong-accusation.yaml`
- Create: `packages/pack/src/samplePack.test.ts`

- [x] **Step 1: Write sample pack regression test**

Create `packages/pack/src/samplePack.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadWorldPack, validateWorldPack } from "./index";

describe("rain-tower sample pack", () => {
  it("loads and validates", () => {
    const pack = loadWorldPack("packs/rain-tower");
    const result = validateWorldPack(pack);

    expect(pack.manifest.id).toBe("rain-tower");
    expect(pack.locations).toHaveLength(3);
    expect(pack.npcs).toHaveLength(3);
    expect(pack.clues).toHaveLength(6);
    expect(pack.items).toHaveLength(2);
    expect(pack.endings.map((ending) => ending.id).sort()).toEqual([
      "true_resolution",
      "unresolved_failure",
      "wrong_accusation"
    ]);
    expect(result.errors).toEqual([]);
  });
});
```

- [x] **Step 2: Run sample pack test to verify failure**

Run:

```bash
npm test -- --run packages/pack/src/samplePack.test.ts
```

Expected: FAIL because `packs/rain-tower` does not exist.

- [x] **Step 3: Create sample pack metadata and world**

Create `packs/rain-tower/manifest.yaml`:

```yaml
id: rain-tower
name: Rain Tower Murder
version: 0.1.0
runtimeVersion: 0.1.0
entryLocationId: foyer
```

Create `packs/rain-tower/world.md`:

```md
# Rain Tower Murder

Lord Halden is found dead below the old tower during a storm. The household claims the tower bell rang by itself at nine. The player must inspect the estate, compare alibis, and accuse the correct suspect with enough evidence.
```

Create `packs/rain-tower/rules.yaml`:

```yaml
allowedPatchTypes:
  - discover_clue
  - add_item
  - remove_item
  - move_location
  - set_flag
  - adjust_npc_attitude
  - set_quest_stage
```

- [x] **Step 4: Create locations, NPCs, clues, items, quests, and endings**

Create `packs/rain-tower/locations.yaml`:

```yaml
- id: foyer
  name: Foyer
  description: A candlelit entry hall where the household waits in silence.
  exits: [study, greenhouse]
  visibleObjects: [silver_watch]
- id: study
  name: Study
  description: Lord Halden's private room, lined with ledgers and a locked desk.
  exits: [foyer, tower]
  visibleObjects: [torn_letter]
- id: greenhouse
  name: Greenhouse
  description: Rain taps against glass panes and mud gathers near the rear door.
  exits: [foyer]
  visibleObjects: [muddy_bootprint]
```

Create `packs/rain-tower/npcs.yaml`:

```yaml
- id: butler
  name: Mr. Vale
  publicDescription: The butler is precise, pale, and careful with every word.
  privateFacts:
    - He reset the tower clock after the murder.
  knows:
    - He saw the heiress leaving the study before nine.
    - He knows the broken watch stopped during the struggle.
  forbiddenDisclosures:
    - He must not confess unless the player has broken_watch and tower_bell_record.
  topics:
    - id: alibi
      prompt: Ask where he was at nine.
      revealsClueId: false_alibi
- id: gardener
  name: Mara Reed
  publicDescription: The gardener smells of rain and soil.
  privateFacts:
    - She hid the greenhouse key to protect the heiress.
  knows:
    - She saw fresh mud on the butler's boots.
  forbiddenDisclosures:
    - She must not reveal the hidden key unless treated respectfully.
  topics:
    - id: boots
      prompt: Ask about muddy boots.
      revealsClueId: muddy_bootprint
- id: heiress
  name: Elian Halden
  publicDescription: The heiress is composed, but her hands tremble.
  privateFacts:
    - She argued with Lord Halden about the torn letter.
  knows:
    - The torn letter proves Lord Halden planned to disinherit her.
  forbiddenDisclosures:
    - She must not identify the killer.
  topics:
    - id: letter
      prompt: Ask about the torn letter.
      revealsClueId: torn_letter
```

Create `packs/rain-tower/clues.yaml`:

```yaml
- id: broken_watch
  name: Broken Watch
  description: A silver watch stopped at 8:47, earlier than the claimed bell time.
  discoverableWhen:
    location_is: foyer
  accusationWeight: 3
- id: muddy_bootprint
  name: Muddy Bootprint
  description: A bootprint in greenhouse mud matches the butler's narrow boots.
  discoverableWhen:
    location_is: greenhouse
  accusationWeight: 3
- id: torn_letter
  name: Torn Letter
  description: A torn letter gives the heiress a motive, but not opportunity.
  discoverableWhen:
    location_is: study
  accusationWeight: 1
- id: greenhouse_key
  name: Greenhouse Key
  description: A key hidden behind a cracked planter connects the greenhouse and service hall.
  discoverableWhen:
    all:
      - location_is: greenhouse
      - flag_true: gardener_trusts_player
  accusationWeight: 2
- id: tower_bell_record
  name: Tower Bell Record
  description: The tower mechanism was manually reset after the murder.
  discoverableWhen:
    location_is: study
  accusationWeight: 3
- id: false_alibi
  name: False Alibi
  description: The butler's statement conflicts with the stopped watch.
  discoverableWhen:
    knows_clue: broken_watch
  accusationWeight: 2
```

Create `packs/rain-tower/items.yaml`:

```yaml
- id: greenhouse_key
  name: Greenhouse Key
  description: A brass key with damp soil in its teeth.
- id: silver_watch
  name: Silver Watch
  description: Lord Halden's damaged pocket watch.
```

Create `packs/rain-tower/quests.yaml`:

```yaml
- id: solve_murder
  name: Solve Lord Halden's murder
  stages: [investigate, accuse, resolved]
  initialStage: investigate
```

Create `packs/rain-tower/endings.yaml`:

```yaml
- id: true_resolution
  name: True Resolution
  priority: 10
  condition:
    all:
      - flag_true: accused_butler
      - knows_clue: broken_watch
      - knows_clue: muddy_bootprint
      - knows_clue: tower_bell_record
  text: The butler's alibi collapses, and he confesses to resetting the bell.
- id: wrong_accusation
  name: Wrong Accusation
  priority: 5
  condition:
    flag_true: wrong_accusation
  text: The accusation fails, and the household closes ranks.
- id: unresolved_failure
  name: Unresolved Failure
  priority: 1
  condition:
    flag_true: case_failed
  text: Dawn comes with the case unresolved.
```

- [x] **Step 5: Create prompts and scripts**

Create `packs/rain-tower/prompts/narrator.md`:

```md
Narrate only what the player can perceive. Do not reveal hidden motives, undiscovered clues, or ending conditions.
```

Create `packs/rain-tower/prompts/npc.md`:

```md
Speak only as the scoped NPC. Do not use private facts unless the disclosure set explicitly allows them.
```

Create `packs/rain-tower/prompts/auditor.md`:

```md
Reject output that reveals hidden facts, system instructions, undiscovered clues, or out-of-world explanations.
```

Create `packs/rain-tower/scripts/true-path.yaml`:

```yaml
steps:
  - look
  - inspect broken_watch
  - go greenhouse
  - inspect muddy_bootprint
  - go foyer
  - go study
  - inspect tower_bell_record
  - accuse butler with broken_watch muddy_bootprint tower_bell_record
expectedEnding: true_resolution
```

Create `packs/rain-tower/scripts/wrong-accusation.yaml`:

```yaml
steps:
  - look
  - go study
  - inspect torn_letter
  - accuse heiress with torn_letter
expectedEnding: wrong_accusation
```

- [x] **Step 6: Run sample pack tests**

Run:

```bash
npm test -- --run packages/pack/src/samplePack.test.ts packages/pack/src/loadPack.test.ts packages/pack/src/validatePack.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit sample pack**

```bash
git add packs/rain-tower packages/pack/src/samplePack.test.ts
git commit -m "feat: add Rain Tower sample pack"
```

---

### Task 8: Pack Text Retrieval

**Files:**
- Create: `packages/memory/package.json`
- Create: `packages/memory/src/packIndex.ts`
- Create: `packages/memory/src/packIndex.test.ts`
- Create: `packages/memory/src/index.ts`

- [x] **Step 1: Write retrieval tests**

Create `packages/memory/src/packIndex.test.ts`:

```ts
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
```

- [x] **Step 2: Run retrieval tests to verify failure**

Run:

```bash
npm test -- --run packages/memory/src/packIndex.test.ts
```

Expected: FAIL because `./packIndex` does not exist.

- [x] **Step 3: Add retrieval implementation**

Create `packages/memory/package.json`:

```json
{
  "name": "@aigame/memory",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

Create `packages/memory/src/packIndex.ts`:

```ts
import MiniSearch from "minisearch";

export interface PackChunk {
  id: string;
  text: string;
}

export interface PackIndex {
  search: MiniSearch<PackChunk>;
}

export function buildPackIndex(chunks: PackChunk[]): PackIndex {
  const search = new MiniSearch<PackChunk>({
    fields: ["text"],
    storeFields: ["id", "text"]
  });
  search.addAll(chunks);
  return { search };
}

export function searchPackIndex(index: PackIndex, query: string, limit: number): PackChunk[] {
  return index.search.search(query, { prefix: true, fuzzy: 0.2 }).slice(0, limit).map((result) => ({
    id: String(result.id),
    text: String(result.text)
  }));
}
```

Create `packages/memory/src/index.ts`:

```ts
export * from "./packIndex";
```

- [x] **Step 4: Run retrieval tests**

Run:

```bash
npm test -- --run packages/memory/src/packIndex.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit retrieval**

```bash
git add packages/memory
git commit -m "feat: index pack narrative text"
```

---

### Task 9: SQLite Persistence

**Files:**
- Create: `packages/persistence/package.json`
- Create: `packages/persistence/src/sqliteStore.ts`
- Create: `packages/persistence/src/sqliteStore.test.ts`
- Create: `packages/persistence/src/index.ts`

- [x] **Step 1: Write persistence tests**

Create `packages/persistence/src/sqliteStore.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSqliteStore } from "./sqliteStore";

describe("sqlite store", () => {
  it("creates sessions and appends events", () => {
    const store = createSqliteStore(":memory:");
    const session = store.createSession({
      packId: "rain-tower",
      initialState: {
        currentLocationId: "foyer",
        turn: 0,
        inventory: [],
        knownClues: [],
        flags: {},
        npcAttitudes: {},
        questStages: { solve_murder: "investigate" }
      }
    });

    store.appendEvent({
      sessionId: session.id,
      turnNo: 1,
      actor: "player",
      inputText: "look",
      action: { type: "look", rawText: "look" },
      outputText: "You stand in the foyer.",
      patches: [],
      trace: { contextIds: ["location:foyer"] }
    });

    expect(store.getSession(session.id)?.state.currentLocationId).toBe("foyer");
    expect(store.listEvents(session.id)).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run persistence tests to verify failure**

Run:

```bash
npm test -- --run packages/persistence/src/sqliteStore.test.ts
```

Expected: FAIL because `./sqliteStore` does not exist.

- [x] **Step 3: Add SQLite store**

Create `packages/persistence/package.json`:

```json
{
  "name": "@aigame/persistence",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@aigame/shared": "*"
  }
}
```

Create `packages/persistence/src/sqliteStore.ts`:

```ts
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { GameAction, GamePatch, SessionState, SessionStateSchema } from "@aigame/shared";

export interface StoredSession {
  id: string;
  packId: string;
  state: SessionState;
}

export interface StoredEvent {
  id: string;
  sessionId: string;
  turnNo: number;
  actor: string;
  inputText: string;
  action: GameAction;
  outputText: string;
  patches: GamePatch[];
  trace: Record<string, unknown>;
}

export function createSqliteStore(path: string) {
  const db = new Database(path);
  db.exec(`
    create table if not exists sessions (
      id text primary key,
      pack_id text not null,
      state_json text not null,
      created_at text not null
    );
    create table if not exists events (
      id text primary key,
      session_id text not null,
      turn_no integer not null,
      actor text not null,
      input_text text not null,
      action_json text not null,
      output_text text not null,
      patches_json text not null,
      trace_json text not null,
      created_at text not null
    );
  `);

  return {
    createSession(input: { packId: string; initialState: SessionState }): StoredSession {
      const id = randomUUID();
      db.prepare("insert into sessions (id, pack_id, state_json, created_at) values (?, ?, ?, ?)")
        .run(id, input.packId, JSON.stringify(input.initialState), new Date().toISOString());
      return { id, packId: input.packId, state: input.initialState };
    },
    updateSessionState(sessionId: string, state: SessionState): void {
      db.prepare("update sessions set state_json = ? where id = ?").run(JSON.stringify(state), sessionId);
    },
    getSession(sessionId: string): StoredSession | undefined {
      const row = db.prepare("select id, pack_id as packId, state_json as stateJson from sessions where id = ?").get(sessionId) as
        | { id: string; packId: string; stateJson: string }
        | undefined;
      if (!row) return undefined;
      return { id: row.id, packId: row.packId, state: SessionStateSchema.parse(JSON.parse(row.stateJson)) };
    },
    appendEvent(input: Omit<StoredEvent, "id">): StoredEvent {
      const id = randomUUID();
      db.prepare(`
        insert into events (id, session_id, turn_no, actor, input_text, action_json, output_text, patches_json, trace_json, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.sessionId,
        input.turnNo,
        input.actor,
        input.inputText,
        JSON.stringify(input.action),
        input.outputText,
        JSON.stringify(input.patches),
        JSON.stringify(input.trace),
        new Date().toISOString()
      );
      return { id, ...input };
    },
    listEvents(sessionId: string): StoredEvent[] {
      const rows = db.prepare("select * from events where session_id = ? order by turn_no asc").all(sessionId) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        sessionId: String(row.session_id),
        turnNo: Number(row.turn_no),
        actor: String(row.actor),
        inputText: String(row.input_text),
        action: JSON.parse(String(row.action_json)),
        outputText: String(row.output_text),
        patches: JSON.parse(String(row.patches_json)),
        trace: JSON.parse(String(row.trace_json))
      }));
    }
  };
}
```

Create `packages/persistence/src/index.ts`:

```ts
export * from "./sqliteStore";
```

- [x] **Step 4: Run persistence tests**

Run:

```bash
npm test -- --run packages/persistence/src/sqliteStore.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit persistence**

```bash
git add packages/persistence
git commit -m "feat: persist sessions and events in sqlite"
```

---

### Task 10: Agent Interfaces, Scoped Contexts, And Auditor

**Files:**
- Create: `packages/agents/package.json`
- Create: `packages/agents/src/modelProvider.ts`
- Create: `packages/agents/src/fakeProvider.ts`
- Create: `packages/agents/src/cloudProvider.ts`
- Create: `packages/agents/src/contexts.ts`
- Create: `packages/agents/src/contexts.test.ts`
- Create: `packages/agents/src/auditor.ts`
- Create: `packages/agents/src/auditor.test.ts`
- Create: `packages/agents/src/index.ts`

- [x] **Step 1: Write scoped context tests**

Create `packages/agents/src/contexts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { SessionState, WorldPack } from "@aigame/shared";
import { buildNpcContext, buildNarratorContext } from "./contexts";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Murder", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "foyer" },
  worldText: "Stormy estate.",
  rules: { allowedPatchTypes: ["discover_clue"] },
  locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: [], visibleObjects: [] }],
  npcs: [{ id: "butler", name: "Mr. Vale", publicDescription: "Precise.", privateFacts: ["He reset the bell."], knows: ["The watch stopped early."], forbiddenDisclosures: ["He reset the bell."], topics: [] }],
  clues: [{ id: "broken_watch", name: "Broken Watch", description: "Stopped.", accusationWeight: 2 }],
  items: [],
  quests: [],
  endings: [],
  prompts: {}
};

const state: SessionState = {
  currentLocationId: "foyer",
  turn: 1,
  inventory: [],
  knownClues: ["broken_watch"],
  flags: {},
  npcAttitudes: {},
  questStages: {}
};

describe("agent contexts", () => {
  it("keeps NPC private facts out of narrator context", () => {
    const context = buildNarratorContext(pack, state, { actionText: "look" });
    expect(JSON.stringify(context)).not.toContain("He reset the bell");
  });

  it("scopes NPC context to one NPC", () => {
    const context = buildNpcContext(pack, state, { npcId: "butler", topic: "alibi" });
    expect(context.npc.id).toBe("butler");
    expect(context.allowedKnownClues).toEqual(["broken_watch"]);
  });
});
```

- [x] **Step 2: Write auditor tests**

Create `packages/agents/src/auditor.test.ts`:

```ts
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
```

- [x] **Step 3: Run agent tests to verify failure**

Run:

```bash
npm test -- --run packages/agents/src/contexts.test.ts packages/agents/src/auditor.test.ts
```

Expected: FAIL because agent files do not exist.

- [x] **Step 4: Add model provider and fake provider**

Create `packages/agents/package.json`:

```json
{
  "name": "@aigame/agents",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@aigame/shared": "*"
  }
}
```

Create `packages/agents/src/modelProvider.ts`:

```ts
export interface RuntimeMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface JsonSchema {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
}

export interface ModelProvider {
  generateStructured<T>(request: {
    model: string;
    system: string;
    messages: RuntimeMessage[];
    schema: JsonSchema;
    temperature?: number;
    maxTokens?: number;
  }): Promise<T>;
}
```

Create `packages/agents/src/fakeProvider.ts`:

```ts
import { GamePatch } from "@aigame/shared";
import { ModelProvider } from "./modelProvider";

export interface AgentResponse {
  narration: string;
  spokenBy: Array<{ npcId: string; text: string }>;
  proposedPatches: GamePatch[];
  privateNotes: string;
}

export class FakeModelProvider implements ModelProvider {
  constructor(private readonly response: AgentResponse = {
    narration: "The scene remains quiet.",
    spokenBy: [],
    proposedPatches: [],
    privateNotes: "fake response"
  }) {}

  async generateStructured<T>(): Promise<T> {
    return this.response as T;
  }
}
```

Create `packages/agents/src/cloudProvider.ts`:

```ts
import { JsonSchema, ModelProvider, RuntimeMessage } from "./modelProvider";

export class OpenAICompatibleProvider implements ModelProvider {
  constructor(private readonly options: { apiKey: string; baseUrl: string }) {}

  async generateStructured<T>(request: {
    model: string;
    system: string;
    messages: RuntimeMessage[];
    schema: JsonSchema;
    temperature?: number;
    maxTokens?: number;
  }): Promise<T> {
    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.options.apiKey}`
      },
      body: JSON.stringify({
        model: request.model,
        temperature: request.temperature ?? 0.2,
        max_tokens: request.maxTokens ?? 1000,
        messages: [
          { role: "system", content: request.system },
          ...request.messages
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "agent_response",
            schema: request.schema
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Model request failed: ${response.status} ${await response.text()}`);
    }

    const body = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = body.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Model response did not include message content");
    }
    return JSON.parse(content) as T;
  }
}
```

- [x] **Step 5: Add scoped contexts and auditor**

Create `packages/agents/src/contexts.ts`:

```ts
import { SessionState, WorldPack } from "@aigame/shared";

export function buildNarratorContext(pack: WorldPack, state: SessionState, input: { actionText: string }) {
  const location = pack.locations.find((candidate) => candidate.id === state.currentLocationId);
  const knownClues = pack.clues.filter((clue) => state.knownClues.includes(clue.id));

  return {
    actionText: input.actionText,
    location,
    knownClues,
    turn: state.turn,
    worldTone: pack.worldText
  };
}

export function buildNpcContext(pack: WorldPack, state: SessionState, input: { npcId: string; topic: string }) {
  const npc = pack.npcs.find((candidate) => candidate.id === input.npcId);
  if (!npc) {
    throw new Error(`Unknown NPC: ${input.npcId}`);
  }

  return {
    npc,
    topic: input.topic,
    currentLocationId: state.currentLocationId,
    allowedKnownClues: state.knownClues,
    attitude: state.npcAttitudes[input.npcId] ?? 0
  };
}
```

Create `packages/agents/src/auditor.ts`:

```ts
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
```

Create `packages/agents/src/index.ts`:

```ts
export * from "./modelProvider";
export * from "./fakeProvider";
export * from "./cloudProvider";
export * from "./contexts";
export * from "./auditor";
```

- [x] **Step 6: Run agent tests**

Run:

```bash
npm test -- --run packages/agents/src/contexts.test.ts packages/agents/src/auditor.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit agents**

```bash
git add packages/agents
git commit -m "feat: add scoped agent interfaces"
```

---

### Task 11: Runtime Action Parser And Orchestrator

**Files:**
- Create: `packages/runtime/package.json`
- Create: `packages/runtime/src/actionParser.ts`
- Create: `packages/runtime/src/actionParser.test.ts`
- Create: `packages/runtime/src/orchestrator.ts`
- Create: `packages/runtime/src/orchestrator.test.ts`
- Create: `packages/runtime/src/index.ts`

- [x] **Step 1: Write action parser tests**

Create `packages/runtime/src/actionParser.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseAction } from "./actionParser";

describe("parseAction", () => {
  it("parses movement", () => {
    expect(parseAction("go study")).toEqual({ type: "move", locationId: "study", rawText: "go study" });
  });

  it("parses inspection", () => {
    expect(parseAction("inspect silver_watch")).toEqual({ type: "inspect", targetId: "silver_watch", rawText: "inspect silver_watch" });
  });

  it("parses accusation clues", () => {
    expect(parseAction("accuse butler with broken_watch muddy_bootprint")).toEqual({
      type: "accuse",
      npcId: "butler",
      clueIds: ["broken_watch", "muddy_bootprint"],
      rawText: "accuse butler with broken_watch muddy_bootprint"
    });
  });
});
```

- [x] **Step 2: Write orchestrator tests**

Create `packages/runtime/src/orchestrator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { FakeModelProvider } from "@aigame/agents";
import { WorldPack, SessionState } from "@aigame/shared";
import { runTurn } from "./orchestrator";

const pack: WorldPack = {
  manifest: { id: "rain-tower", name: "Rain Tower Murder", version: "0.1.0", runtimeVersion: "0.1.0", entryLocationId: "foyer" },
  worldText: "Stormy estate.",
  rules: { allowedPatchTypes: ["discover_clue", "move_location", "set_flag"] },
  locations: [{ id: "foyer", name: "Foyer", description: "Entry.", exits: ["study"], visibleObjects: ["broken_watch"] }, { id: "study", name: "Study", description: "Books.", exits: [], visibleObjects: [] }],
  npcs: [],
  clues: [{ id: "broken_watch", name: "Broken Watch", description: "Stopped.", discoverableWhen: { location_is: "foyer" }, accusationWeight: 2 }],
  items: [],
  quests: [],
  endings: [],
  prompts: {}
};

const initialState: SessionState = {
  currentLocationId: "foyer",
  turn: 0,
  inventory: [],
  knownClues: [],
  flags: {},
  npcAttitudes: {},
  questStages: {}
};

describe("runTurn", () => {
  it("accepts valid agent patches and advances turn", async () => {
    const result = await runTurn({
      pack,
      state: initialState,
      inputText: "inspect broken_watch",
      model: new FakeModelProvider({
        narration: "The watch is cracked and stopped.",
        spokenBy: [],
        proposedPatches: [{ type: "discover_clue", clueId: "broken_watch", reason: "Player inspected it." }],
        privateNotes: "test"
      })
    });

    expect(result.state.knownClues).toEqual(["broken_watch"]);
    expect(result.state.turn).toBe(1);
    expect(result.rejectedPatches).toEqual([]);
  });
});
```

- [x] **Step 3: Run runtime tests to verify failure**

Run:

```bash
npm test -- --run packages/runtime/src/actionParser.test.ts packages/runtime/src/orchestrator.test.ts
```

Expected: FAIL because runtime files do not exist.

- [x] **Step 4: Add action parser**

Create `packages/runtime/package.json`:

```json
{
  "name": "@aigame/runtime",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "dependencies": {
    "@aigame/shared": "*",
    "@aigame/rules": "*",
    "@aigame/agents": "*"
  }
}
```

Create `packages/runtime/src/actionParser.ts`:

```ts
import { GameAction } from "@aigame/shared";

export function parseAction(inputText: string): GameAction {
  const rawText = inputText.trim();
  const [verb, first, ...rest] = rawText.split(/\s+/);

  if (!verb || verb === "look") return { type: "look", rawText };
  if ((verb === "go" || verb === "move") && first) return { type: "move", locationId: first, rawText };
  if ((verb === "inspect" || verb === "examine") && first) return { type: "inspect", targetId: first, rawText };
  if (verb === "ask" && first) return { type: "ask", npcId: first, topic: rest.join(" "), rawText };
  if (verb === "use" && first) return { type: "use", itemId: first, targetId: rest[1], rawText };
  if (verb === "accuse" && first) {
    const withIndex = rest.indexOf("with");
    const clueIds = withIndex >= 0 ? rest.slice(withIndex + 1) : [];
    return { type: "accuse", npcId: first, clueIds, rawText };
  }

  return { type: "unknown", rawText };
}
```

- [x] **Step 5: Add orchestrator**

Create `packages/runtime/src/orchestrator.ts`:

```ts
import { auditOutput, buildNarratorContext, FakeModelProvider, ModelProvider } from "@aigame/agents";
import { GameAction, GamePatch, SessionState, WorldPack } from "@aigame/shared";
import { applyAcceptedPatch, evaluateCondition, judgeEnding, validatePatch } from "@aigame/rules";
import { parseAction } from "./actionParser";

export interface TurnResult {
  outputText: string;
  state: SessionState;
  acceptedPatches: GamePatch[];
  rejectedPatches: Array<{ patch: GamePatch; reason: string }>;
  endingId?: string;
  trace: Record<string, unknown>;
}

export async function runTurn(input: {
  pack: WorldPack;
  state: SessionState;
  inputText: string;
  model?: ModelProvider;
}): Promise<TurnResult> {
  const model = input.model ?? new FakeModelProvider();
  const action = parseAction(input.inputText);
  const context = buildNarratorContext(input.pack, input.state, { actionText: input.inputText });

  const response = await model.generateStructured<{
    narration: string;
    spokenBy: Array<{ npcId: string; text: string }>;
    proposedPatches: GamePatch[];
    privateNotes: string;
  }>({
    model: "fake",
    system: "Return narration and proposed patches. Do not mutate state directly.",
    messages: [{ role: "user", content: JSON.stringify({ action, context }) }],
    schema: { type: "object" }
  });

  const acceptedPatches: GamePatch[] = [];
  const rejectedPatches: Array<{ patch: GamePatch; reason: string }> = [];
  let nextState: SessionState = { ...input.state, turn: input.state.turn + 1 };

  const rulePatches = deriveRulePatches(action, input.pack, input.state);

  for (const patch of [...rulePatches, ...response.proposedPatches]) {
    const validation = validatePatch(patch, input.pack, nextState);
    if (validation.ok) {
      acceptedPatches.push(patch);
      nextState = applyAcceptedPatch(patch, nextState);
    } else {
      rejectedPatches.push({ patch, reason: validation.reason });
    }
  }

  const ending = judgeEnding(input.pack, nextState);
  const outputText = ending ? `${response.narration}\n\n${ending.text}` : response.narration;
  const audit = auditOutput(outputText, { forbiddenPhrases: collectForbiddenPhrases(input.pack), requireInWorld: true });

  return {
    outputText: audit.ok ? outputText : "The moment feels unclear. Rephrase your action.",
    state: nextState,
    acceptedPatches,
    rejectedPatches,
    endingId: ending?.id,
    trace: {
      action,
      contextIds: [`location:${input.state.currentLocationId}`],
      privateNotes: response.privateNotes,
      audit
    }
  };
}

function collectForbiddenPhrases(pack: WorldPack): string[] {
  return pack.npcs.flatMap((npc) => npc.forbiddenDisclosures);
}

function deriveRulePatches(action: GameAction, pack: WorldPack, state: SessionState): GamePatch[] {
  if (action.type === "inspect") {
    const clue = pack.clues.find((candidate) => candidate.id === action.targetId);
    if (clue && !state.knownClues.includes(clue.id) && evaluateCondition(clue.discoverableWhen, state)) {
      return [{ type: "discover_clue", clueId: clue.id, reason: `Inspected ${action.targetId}.` }];
    }
  }

  if (action.type === "move") {
    return [{ type: "move_location", locationId: action.locationId, reason: `Moved to ${action.locationId}.` }];
  }

  if (action.type === "accuse") {
    const evidence = new Set([...state.knownClues, ...action.clueIds]);
    const hasTrueEvidence =
      action.npcId === "butler" &&
      evidence.has("broken_watch") &&
      evidence.has("muddy_bootprint") &&
      evidence.has("tower_bell_record");

    return hasTrueEvidence
      ? [{ type: "set_flag", flag: "accused_butler", value: true, reason: "Player accused the butler with required evidence." }]
      : [{ type: "set_flag", flag: "wrong_accusation", value: true, reason: "Player accused without the required evidence." }];
  }

  return [];
}
```

Create `packages/runtime/src/index.ts`:

```ts
export * from "./actionParser";
export * from "./orchestrator";
```

- [x] **Step 6: Run runtime tests**

Run:

```bash
npm test -- --run packages/runtime/src/actionParser.test.ts packages/runtime/src/orchestrator.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit runtime**

```bash
git add packages/runtime
git commit -m "feat: run rule-checked game turns"
```

---

### Task 12: Scripted Simulator

**Files:**
- Modify: `packages/runtime/src/index.ts`
- Create: `packages/runtime/src/simulator.ts`
- Create: `packages/runtime/src/simulator.test.ts`

- [x] **Step 1: Write simulator tests**

Create `packages/runtime/src/simulator.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { loadWorldPack } from "@aigame/pack";
import { FakeModelProvider } from "@aigame/agents";
import { runSimulation } from "./simulator";

describe("runSimulation", () => {
  it("runs scripted turns against a pack", async () => {
    const pack = loadWorldPack("packs/rain-tower");
    const result = await runSimulation({
      pack,
      steps: ["inspect broken_watch"],
      model: new FakeModelProvider({
        narration: "The watch is cracked.",
        spokenBy: [],
        proposedPatches: [{ type: "discover_clue", clueId: "broken_watch", reason: "Inspected the watch." }],
        privateNotes: "simulation"
      })
    });

    expect(result.finalState.knownClues).toContain("broken_watch");
    expect(result.turns).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run simulator tests to verify failure**

Run:

```bash
npm test -- --run packages/runtime/src/simulator.test.ts
```

Expected: FAIL because `./simulator` does not exist.

- [x] **Step 3: Add simulator**

Create `packages/runtime/src/simulator.ts`:

```ts
import { ModelProvider } from "@aigame/agents";
import { SessionState, WorldPack } from "@aigame/shared";
import { runTurn, TurnResult } from "./orchestrator";

export async function runSimulation(input: {
  pack: WorldPack;
  steps: string[];
  model?: ModelProvider;
}): Promise<{ finalState: SessionState; finalEndingId?: string; turns: TurnResult[] }> {
  let state: SessionState = {
    currentLocationId: input.pack.manifest.entryLocationId,
    turn: 0,
    inventory: [],
    knownClues: [],
    flags: {},
    npcAttitudes: {},
    questStages: Object.fromEntries(input.pack.quests.map((quest) => [quest.id, quest.initialStage]))
  };
  const turns: TurnResult[] = [];

  for (const step of input.steps) {
    const result = await runTurn({ pack: input.pack, state, inputText: step, model: input.model });
    turns.push(result);
    state = result.state;
  }

  return { finalState: state, finalEndingId: turns.at(-1)?.endingId, turns };
}
```

Replace `packages/runtime/src/index.ts`:

```ts
export * from "./actionParser";
export * from "./orchestrator";
export * from "./simulator";
```

- [x] **Step 4: Run simulator tests**

Run:

```bash
npm test -- --run packages/runtime/src/simulator.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit simulator**

```bash
git add packages/runtime/src/simulator.ts packages/runtime/src/simulator.test.ts packages/runtime/src/index.ts
git commit -m "feat: run scripted game simulations"
```

---

### Task 13: CLI Tools

**Files:**
- Create: `apps/cli/package.json`
- Create: `apps/cli/src/main.ts`
- Create: `apps/cli/src/main.test.ts`

- [x] **Step 1: Write CLI tests**

Create `apps/cli/src/main.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { runCli } from "./main";

describe("CLI", () => {
  it("validates the sample pack", async () => {
    const result = await runCli(["validate", "packs/rain-tower"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Pack valid: rain-tower");
  });

  it("shows simulation output", async () => {
    const result = await runCli(["simulate", "packs/rain-tower", "packs/rain-tower/scripts/true-path.yaml"]);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Simulation completed");
  });
});
```

- [x] **Step 2: Run CLI tests to verify failure**

Run:

```bash
npm test -- --run apps/cli/src/main.test.ts
```

Expected: FAIL because `apps/cli/src/main.ts` does not exist.

- [x] **Step 3: Add CLI implementation**

Create `apps/cli/package.json`:

```json
{
  "name": "@aigame/cli",
  "private": true,
  "type": "module",
  "main": "src/main.ts",
  "dependencies": {
    "@aigame/pack": "*",
    "@aigame/runtime": "*"
  }
}
```

Create `apps/cli/src/main.ts`:

```ts
import { readFileSync } from "node:fs";
import YAML from "yaml";
import { loadWorldPack, validateWorldPack } from "@aigame/pack";
import { runSimulation } from "@aigame/runtime";

export interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export async function runCli(args: string[]): Promise<CliResult> {
  const [command, packPath, scriptPath] = args;

  if (command === "validate" && packPath) {
    const pack = loadWorldPack(packPath);
    const validation = validateWorldPack(pack);
    if (!validation.ok) {
      return { exitCode: 1, stdout: "", stderr: validation.errors.join("\n") };
    }
    return { exitCode: 0, stdout: `Pack valid: ${pack.manifest.id}\n`, stderr: "" };
  }

  if (command === "simulate" && packPath && scriptPath) {
    const pack = loadWorldPack(packPath);
    const script = YAML.parse(readFileSync(scriptPath, "utf8")) as { steps: string[]; expectedEnding?: string };
    const result = await runSimulation({ pack, steps: script.steps });
    if (script.expectedEnding && result.finalEndingId !== script.expectedEnding) {
      return {
        exitCode: 1,
        stdout: "",
        stderr: `Expected ending ${script.expectedEnding} but got ${result.finalEndingId ?? "none"}\n`
      };
    }
    return {
      exitCode: 0,
      stdout: `Simulation completed: ${result.turns.length} turns\nEnding: ${result.finalEndingId ?? "none"}\nKnown clues: ${result.finalState.knownClues.join(",")}\n`,
      stderr: ""
    };
  }

  return {
    exitCode: 1,
    stdout: "",
    stderr: "Usage: validate <packPath> | simulate <packPath> <scriptPath>\n"
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runCli(process.argv.slice(2));
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
}
```

- [x] **Step 4: Run CLI tests**

Run:

```bash
npm test -- --run apps/cli/src/main.test.ts
```

Expected: PASS.

- [x] **Step 5: Manually verify CLI command**

Run:

```bash
npm run cli -- validate packs/rain-tower
```

Expected stdout:

```text
Pack valid: rain-tower
```

- [x] **Step 6: Commit CLI**

```bash
git add apps/cli
git commit -m "feat: add pack validation and simulation CLI"
```

---

### Task 14: Web Player API And UI

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/api/session/route.ts`
- Create: `apps/web/app/api/turn/route.ts`
- Create: `apps/web/src/components/GameShell.tsx`
- Create: `apps/web/src/components/GameShell.test.tsx`
- Create: `apps/web/src/server/sessionStore.ts`

- [x] **Step 1: Write Web component test**

Create `apps/web/src/components/GameShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GameShell } from "./GameShell";

describe("GameShell", () => {
  it("renders the player-facing panels", () => {
    render(<GameShell />);

    expect(screen.getByRole("heading", { name: "Rain Tower Murder" })).toBeTruthy();
    expect(screen.getByLabelText("Action input")).toBeTruthy();
    expect(screen.getByText("Current Location")).toBeTruthy();
    expect(screen.getByText("Known Clues")).toBeTruthy();
    expect(screen.getByText("Inventory")).toBeTruthy();
  });
});
```

- [x] **Step 2: Run Web test to verify failure**

Run:

```bash
npm test -- --run apps/web/src/components/GameShell.test.tsx --environment jsdom
```

Expected: FAIL because `GameShell` does not exist.

- [x] **Step 3: Add Next.js app shell files**

Create `apps/web/package.json`:

```json
{
  "name": "@aigame/web",
  "private": true,
  "type": "module",
  "dependencies": {
    "@aigame/pack": "*",
    "@aigame/runtime": "*",
    "@aigame/agents": "*",
    "@aigame/shared": "*",
    "@aigame/persistence": "*"
  }
}
```

Create `apps/web/next.config.mjs`:

```js
const nextConfig = {
  transpilePackages: [
    "@aigame/shared",
    "@aigame/pack",
    "@aigame/rules",
    "@aigame/agents",
    "@aigame/runtime",
    "@aigame/persistence"
  ]
};

export default nextConfig;
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "preserve",
    "allowJs": true,
    "noEmit": true,
    "incremental": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

Create `apps/web/app/layout.tsx`:

```tsx
import "./globals.css";
import type { ReactNode } from "react";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `apps/web/app/page.tsx`:

```tsx
import { GameShell } from "../src/components/GameShell";

export default function Page() {
  return <GameShell />;
}
```

- [x] **Step 4: Add GameShell component and CSS**

Create `apps/web/src/components/GameShell.tsx`:

```tsx
"use client";

import { FormEvent, useEffect, useState } from "react";
import type { SessionState } from "@aigame/shared";

export function GameShell() {
  const [turns, setTurns] = useState<string[]>(["Rain hammers the old tower as the household waits in the foyer."]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [state, setState] = useState<SessionState | undefined>();
  const [trace, setTrace] = useState("No turns submitted.");

  useEffect(() => {
    void fetch("/api/session", { method: "POST" })
      .then((response) => response.json())
      .then((body: { sessionId: string; state: SessionState }) => {
        setSessionId(body.sessionId);
        setState(body.state);
      })
      .catch(() => setTrace("Session API unavailable."));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || !sessionId) return;
    const response = await fetch("/api/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, inputText: input })
    });
    const body = await response.json() as {
      outputText: string;
      state: SessionState;
      acceptedPatches: unknown[];
      rejectedPatches: unknown[];
      trace: { contextIds?: string[] };
    };
    setState(body.state);
    setTrace(`contexts=${body.trace.contextIds?.join(",") ?? ""}; accepted=${body.acceptedPatches.length}; rejected=${body.rejectedPatches.length}`);
    setTurns((current) => [...current, `> ${input}`, body.outputText]);
    setInput("");
  }

  return (
    <main className="shell">
      <section className="narrative" aria-label="Narrative">
        <h1>Rain Tower Murder</h1>
        <div className="turns">
          {turns.map((turn, index) => (
            <p key={`${index}-${turn}`}>{turn}</p>
          ))}
        </div>
        <form onSubmit={submit} className="action-form">
          <label htmlFor="action-input">Action input</label>
          <div className="action-row">
            <input
              id="action-input"
              aria-label="Action input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="inspect silver_watch"
            />
            <button type="submit">Send</button>
          </div>
        </form>
      </section>
      <aside className="sidebar">
        <section>
          <h2>Current Location</h2>
          <p>{state?.currentLocationId ?? "Loading"}</p>
        </section>
        <section>
          <h2>Known Clues</h2>
          <p>{state && state.knownClues.length > 0 ? state.knownClues.join(", ") : "No clues discovered."}</p>
        </section>
        <section>
          <h2>Inventory</h2>
          <p>{state && state.inventory.length > 0 ? state.inventory.join(", ") : "Empty"}</p>
        </section>
        <section>
          <h2>Developer Trace</h2>
          <p>{trace}</p>
        </section>
      </aside>
    </main>
  );
}
```

Create `apps/web/app/globals.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  color: #161616;
  background: #f4f1ec;
}

.shell {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 24px;
  padding: 24px;
}

.narrative,
.sidebar section {
  background: #ffffff;
  border: 1px solid #d8d2c8;
  border-radius: 8px;
  padding: 18px;
}

h1,
h2 {
  margin: 0 0 12px;
}

.turns {
  min-height: 420px;
  border-top: 1px solid #e4ded5;
  padding-top: 12px;
}

.action-form {
  display: grid;
  gap: 8px;
}

.action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 96px;
  gap: 8px;
}

input,
button {
  min-height: 40px;
  font: inherit;
}

button {
  cursor: pointer;
}

.sidebar {
  display: grid;
  gap: 16px;
  align-content: start;
}

@media (max-width: 800px) {
  .shell {
    grid-template-columns: 1fr;
    padding: 12px;
  }
}
```

- [x] **Step 5: Add session store and API routes backed by runtime**

Create `apps/web/src/server/sessionStore.ts`:

```ts
import { createSqliteStore } from "@aigame/persistence";

export const sessionStore = createSqliteStore(process.env.AIGAME_DB_PATH ?? "aigame.db");
```

Create `apps/web/app/api/session/route.ts`:

```ts
import { NextResponse } from "next/server";
import { loadWorldPack } from "@aigame/pack";
import { sessionStore } from "../../../src/server/sessionStore";

export async function POST() {
  const pack = loadWorldPack("packs/rain-tower");
  const state = {
    currentLocationId: pack.manifest.entryLocationId,
    turn: 0,
    inventory: [],
    knownClues: [],
    flags: {},
    npcAttitudes: {},
    questStages: Object.fromEntries(pack.quests.map((quest) => [quest.id, quest.initialStage]))
  };
  const session = sessionStore.createSession({ packId: pack.manifest.id, initialState: state });

  return NextResponse.json({
    sessionId: session.id,
    packId: pack.manifest.id,
    state
  });
}
```

Create `apps/web/app/api/turn/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { FakeModelProvider } from "@aigame/agents";
import { loadWorldPack } from "@aigame/pack";
import { runTurn } from "@aigame/runtime";
import { ActionSchema } from "@aigame/shared";
import { sessionStore } from "../../../src/server/sessionStore";

export async function POST(request: NextRequest) {
  const body = await request.json() as { sessionId: string; inputText: string };
  const pack = loadWorldPack("packs/rain-tower");
  const session = sessionStore.getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const result = await runTurn({
    pack,
    state: session.state,
    inputText: body.inputText,
    model: new FakeModelProvider()
  });
  sessionStore.updateSessionState(body.sessionId, result.state);
  sessionStore.appendEvent({
    sessionId: body.sessionId,
    turnNo: result.state.turn,
    actor: "player",
    inputText: body.inputText,
    action: ActionSchema.parse(result.trace.action),
    outputText: result.outputText,
    patches: result.acceptedPatches,
    trace: result.trace
  });

  return NextResponse.json(result);
}
```

- [x] **Step 6: Run Web component test**

Run:

```bash
npm test -- --run apps/web/src/components/GameShell.test.tsx --environment jsdom
```

Expected: PASS.

- [x] **Step 7: Build Web app**

Run:

```bash
npm run web:build
```

Expected: Next.js build succeeds.

- [x] **Step 8: Commit Web player shell**

```bash
git add apps/web
git commit -m "feat: add web player shell"
```

---

### Task 15: Developer Trace UI And Playwright Smoke Test

**Files:**
- Create: `apps/web/tests/player.spec.ts`

- [x] **Step 1: Add Playwright smoke test**

Create `apps/web/tests/player.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("player can see the case interface", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Rain Tower Murder" })).toBeVisible();
  await expect(page.getByLabel("Action input")).toBeVisible();
  await expect(page.getByText("Known Clues")).toBeVisible();
  await expect(page.getByText("Developer Trace")).toBeVisible();
});
```

- [x] **Step 2: Run Playwright to verify the baseline**

Run:

```bash
npm run e2e
```

Expected: PASS with one browser test.

- [x] **Step 3: Extend Playwright test for a real turn**

Modify `apps/web/tests/player.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("player can see the case interface", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Rain Tower Murder" })).toBeVisible();
  await expect(page.getByLabel("Action input")).toBeVisible();
  await expect(page.getByText("Known Clues")).toBeVisible();
  await expect(page.getByText("Developer Trace")).toBeVisible();
  await expect(page.getByText("foyer")).toBeVisible();

  await page.getByLabel("Action input").fill("inspect broken_watch");
  await page.getByRole("button", { name: "Send" }).click();

  await expect(page.getByText("broken_watch")).toBeVisible();
  await expect(page.getByText(/accepted=1/)).toBeVisible();
});
```

- [x] **Step 4: Run Web and e2e tests**

Run:

```bash
npm test -- --run apps/web/src/components/GameShell.test.tsx --environment jsdom
npm run e2e
```

Expected: both commands PASS.

- [x] **Step 5: Commit trace UI**

```bash
git add apps/web/tests/player.spec.ts
git commit -m "feat: expose developer trace panel"
```

---

### Task 16: Final Verification And Documentation Update

**Files:**
- Modify: `docs/superpowers/specs/2026-05-23-ai-interactive-game-design.md`
- Create: `README.md`

- [x] **Step 1: Create README with runnable commands**

Create `README.md`:

```md
# AI Interactive Game MVP

This repository contains a TypeScript MVP for an importable AI interactive detective game runtime.

## Commands

```bash
npm install
npm test
npm run typecheck
npm run cli -- validate packs/rain-tower
npm run cli -- simulate packs/rain-tower packs/rain-tower/scripts/true-path.yaml
npm run web:dev
```

## Architecture

The runtime uses a programmatic Director Orchestrator, scoped Narrator and NPC Actor model calls, rule-checked patches, and event traces. AI proposes narrative and patches; rules decide state.
```

- [x] **Step 2: Mark the spec as implemented by MVP branch**

Modify the status line in `docs/superpowers/specs/2026-05-23-ai-interactive-game-design.md`:

```md
Status: MVP implementation plan created; implementation follows this spec
```

- [x] **Step 3: Run complete verification**

Run:

```bash
npm test
npm run typecheck
npm run cli -- validate packs/rain-tower
npm run cli -- simulate packs/rain-tower packs/rain-tower/scripts/true-path.yaml
npm run web:build
npm run e2e
```

Expected:

- `npm test` passes all unit/component tests.
- `npm run typecheck` exits with code 0.
- CLI validation prints `Pack valid: rain-tower`.
- CLI simulation prints `Simulation completed`.
- Web build succeeds.
- Playwright passes the player smoke test.

- [x] **Step 4: Check git status**

Run:

```bash
git status --short
```

Expected: only intended README and spec changes appear before commit.

- [x] **Step 5: Commit final docs**

```bash
git add README.md docs/superpowers/specs/2026-05-23-ai-interactive-game-design.md
git commit -m "docs: document MVP commands"
```

---

## Self-Review Notes

Spec coverage:

- Product positioning, importable packs, and MVP scope are covered by Tasks 1, 7, 13, 14, and 16.
- Pack loading, schema validation, reference validation, and sample pack are covered by Tasks 2, 3, 4, and 7.
- Hybrid rules, hard constraints, condition expressions, patch validation, and endings are covered by Tasks 5 and 6.
- Programmatic Director Orchestrator, scoped Narrator/NPC contexts, ModelProvider, and auditor are covered by Tasks 10 and 11.
- BM25-style retrieval is covered by Task 8.
- SQLite session/event persistence is covered by Task 9.
- CLI debugging and simulation are covered by Tasks 12 and 13.
- Web player interface and developer trace panel are covered by Tasks 14 and 15.
- Final verification is covered by Task 16.

Type consistency:

- `WorldPack`, `SessionState`, `GameAction`, and `GamePatch` originate in `@aigame/shared`.
- `validatePatch`, `applyAcceptedPatch`, and `judgeEnding` originate in `@aigame/rules`.
- `ModelProvider`, `FakeModelProvider`, `buildNarratorContext`, `buildNpcContext`, and `auditOutput` originate in `@aigame/agents`.
- `parseAction`, `runTurn`, and `runSimulation` originate in `@aigame/runtime`.

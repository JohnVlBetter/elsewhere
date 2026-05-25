# Core Agent Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move reusable agent prompt constraints out of world packs into the core agent package, with standalone prompt templates read and assembled by code.

**Architecture:** `@aigame/agents` owns role prompts and prompt assembly. `@aigame/runtime` asks the agents package for a role-specific system prompt. `@aigame/pack` and `WorldPack` stop loading or exposing pack prompt overrides.

**Tech Stack:** TypeScript, Vitest, Zod, Node fs/path utilities.

---

### Task 1: Remove Pack Prompt Surface

**Files:**
- Modify: `packages/shared/src/domain.ts`
- Modify: `packages/pack/src/loadPack.ts`
- Test: `packages/pack/src/loadPack.test.ts`
- Test: `packages/pack/src/packagePack.test.ts`
- Test fixtures: `packages/*/src/*.test.ts`

- [ ] **Step 1: Write failing tests**

Assert `loadWorldPack()` ignores `prompts/` directories and `buildPackArchive()` no longer packages `prompts/*`.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- packages/pack/src/loadPack.test.ts packages/pack/src/packagePack.test.ts`
Expected: FAIL because `WorldPack.prompts` and archived prompt files still exist.

- [ ] **Step 3: Implement schema and loader removal**

Remove `prompts` from `WorldPackSchema`, remove prompt directory reading from `loadPack.ts`, and make `packagePack.ts` skip `prompts/`.

- [ ] **Step 4: Update fixtures**

Remove `prompts: {}` from test `WorldPack` literals.

### Task 2: Add Core Prompt Templates

**Files:**
- Create: `packages/agents/src/prompts/language.md`
- Create: `packages/agents/src/prompts/core.md`
- Create: `packages/agents/src/prompts/narrator.md`
- Create: `packages/agents/src/prompts/npc.md`
- Create: `packages/agents/src/prompts/response.md`
- Create: `packages/agents/src/prompts.ts`
- Modify: `packages/agents/src/index.ts`
- Test: `packages/agents/src/prompts.test.ts`

- [ ] **Step 1: Write failing tests**

Assert `buildSystemPrompt("narrator")` includes language, core, narrator, response sections; assert `buildSystemPrompt("npc")` includes NPC section and excludes narrator section.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- packages/agents/src/prompts.test.ts`
Expected: FAIL because `buildSystemPrompt` does not exist.

- [ ] **Step 3: Implement prompt reader and assembler**

Read markdown templates from `packages/agents/src/prompts/*.md` with `readFileSync`, cache by filename, and join relevant sections with blank lines.

### Task 3: Wire Runtime to Core Prompts

**Files:**
- Modify: `packages/runtime/src/orchestrator.ts`
- Test: `packages/runtime/src/orchestrator.test.ts`

- [ ] **Step 1: Write failing runtime test**

Assert runtime system text includes a strong core prompt phrase from the new template and cannot be overridden by pack data.

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- packages/runtime/src/orchestrator.test.ts`
Expected: FAIL until runtime uses `buildSystemPrompt`.

- [ ] **Step 3: Replace inline prompt construction**

Import `buildSystemPrompt` from `@aigame/agents` and use it for NPC and narrator requests.

### Task 4: Remove Sample Pack Prompts

**Files:**
- Delete: `packs/rain-tower/prompts/language.md`
- Delete: `packs/rain-tower/prompts/narrator.md`
- Delete: `packs/rain-tower/prompts/npc.md`
- Delete: `packs/rain-tower/prompts/auditor.md`

- [ ] **Step 1: Delete prompt files**

Remove reusable behavioral prompts from the pack so the pack only contains world content.

- [ ] **Step 2: Verify pack tests and package output**

Run targeted pack tests and full test suite.

# Web Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished Chinese detective-game UI for the existing Rain Tower web MVP.

**Architecture:** Keep the existing Next.js app and API flow. Refactor `GameShell.tsx` into focused internal UI components and move presentation into `globals.css` design tokens and responsive classes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Testing Library, Playwright, CSS.

---

## Files

- Modify: `apps/web/src/components/GameShell.test.tsx` to require the Chinese player-facing UI and trace behavior.
- Modify: `apps/web/tests/player.spec.ts` to verify the Chinese e2e flow.
- Modify: `apps/web/src/components/GameShell.tsx` to decompose the UI, localize text, map known IDs, and handle submit errors.
- Modify: `apps/web/app/globals.css` to replace the plain layout with the detective desk visual system.
- Modify: `apps/web/app/layout.tsx` to set `lang="zh-CN"`.
- Modify: `.gitignore` to ignore Superpowers visual companion artifacts.

## Tasks

### Task 1: Test the Chinese Interface Contract

- [ ] Update `apps/web/src/components/GameShell.test.tsx` so `renders the player-facing panels` expects `雨塔谋杀案`, `行动指令`, `发送`, `当前位置`, `已知线索`, `随身物品`, and `开发追踪`.
- [ ] Update the trace test to fill `询问管家的不在场证明`, click `发送`, and expect `角色=npc`, `预检=通过`, and the raw narration in the `开发追踪` region.
- [ ] Update `apps/web/tests/player.spec.ts` to use the same Chinese title, labels, and panels while still sending `inspect broken_watch` because the parser currently understands English commands.
- [ ] Run `npm test -- apps/web/src/components/GameShell.test.tsx`; expected result before implementation: fail because the current UI is English.

### Task 2: Implement the GameShell Redesign

- [ ] Replace the flat JSX in `apps/web/src/components/GameShell.tsx` with focused internal components: `HeroPanel`, `StoryLog`, `ActionComposer`, `CasePanel`, `CollectionPanel`, `TracePanel`, and `QuickActions`.
- [ ] Add UI helper functions: `formatId`, `labelLocation`, `labelClue`, `labelItem`, `labelQuestStage`, and `formatTraceSummary`.
- [ ] Preserve existing session and turn API calls.
- [ ] Add failure handling for `/api/session` and `/api/turn` that writes Chinese failure copy to the trace or story log.
- [ ] Run `npm test -- apps/web/src/components/GameShell.test.tsx`; expected result after implementation: pass.

### Task 3: Apply the Visual System

- [ ] Replace `apps/web/app/globals.css` with responsive CSS variables, dark case-file background, panel styles, story log, chips, action bar, quick action buttons, and mobile layout.
- [ ] Set `apps/web/app/layout.tsx` to `<html lang="zh-CN">`.
- [ ] Run `npm run typecheck`; expected result: exit code 0.

### Task 4: Verify the Browser Flow

- [ ] Run `npm run web:build`; expected result: exit code 0.
- [ ] Run `npm run e2e`; expected result: Playwright confirms the Chinese UI, initial `foyer` state displayed as `门厅`, submitting `inspect broken_watch`, seeing `破损怀表`, and seeing `accepted=1` in trace.

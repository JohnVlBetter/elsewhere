# AI Interactive Game MVP

This repository contains a TypeScript MVP for an importable AI interactive detective game runtime.

## Commands

```bash
npm install
npm test
npm run typecheck
npm run cli -- validate packs/rain-tower
npm run cli -- simulate packs/rain-tower packs/rain-tower/scripts/true-path.yaml
npm run e2e:install
npm run e2e
npm run web:dev
```

## Architecture

The runtime uses a programmatic Director Orchestrator, scoped Narrator and NPC Actor model calls, rule-checked patches, and event traces. AI proposes narrative and patches; rules decide state.

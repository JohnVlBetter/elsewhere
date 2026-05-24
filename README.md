# AI Interactive Game MVP

This repository contains a TypeScript MVP for an importable AI interactive detective game runtime.

## Commands

```bash
npm install
npm test
npm run typecheck
npm run cli -- validate packs/rain-tower
npm run cli -- pack packs/rain-tower dist/rain-tower.aipack
npm run cli -- simulate packs/rain-tower packs/rain-tower/scripts/true-path.yaml
npm run e2e:install
npm run e2e
npm run web:dev
```

## Cloud model

The web app uses the deterministic fake provider unless a cloud key is configured.

For DeepSeek, set these in your local shell or `.env.local`:

```bash
DEEPSEEK_API_KEY=your-key-here
DEEPSEEK_MODEL=deepseek-v4-pro
```

`DEEPSEEK_MODEL` can be changed to another model name your account exposes, such as a flash variant. Do not commit real keys.

## Architecture

The runtime uses a programmatic Director Orchestrator, scoped Narrator and NPC Actor model calls, rule-checked patches, and event traces. AI proposes narrative and patches; rules decide state.

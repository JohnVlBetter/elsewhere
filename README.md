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
npm run web:start
```

`npm run web:start` is the Windows one-command launcher. It loads root `.env.local`, stops any process already listening on port 3000, then starts the web app at `http://127.0.0.1:3000`.

Runtime SQLite files default to `.tmp/aigame.db` for the web app and `.tmp/aigame-cli.db` for the CLI. Override them with `AIGAME_DB_PATH` and `AIGAME_CLI_DB_PATH` when needed.

To choose a different port directly:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-web.ps1 -Port 3001
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

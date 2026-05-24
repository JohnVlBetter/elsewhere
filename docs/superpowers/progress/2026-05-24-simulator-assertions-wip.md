# Simulator Assertions

Status: implemented and verified.

Original WIP started after: `cda54cf feat: add rules precheck trace`.

Implemented:

- Runtime simulation assertions:
  - `expectedKnownClues`
  - `expectedFlags`
  - `forbiddenOutputPhrases`
- `runSimulation` returns `assertionFailures`.
- CLI `simulate` parses script assertions and exits non-zero with assertion failure messages.
- Sample true and wrong accusation scripts include passing assertions.

Verification run:

- `npm test -- --run packages/runtime/src/simulator.test.ts apps/cli/src/main.test.ts`
- `npm test`
- `npm run typecheck`
- `npm run cli -- validate packs/rain-tower`
- `npm run cli -- simulate packs/rain-tower packs/rain-tower/scripts/true-path.yaml`
- `npm run cli -- simulate packs/rain-tower packs/rain-tower/scripts/wrong-accusation.yaml`
- `npm run cli -- pack packs/rain-tower dist/rain-tower.aipack`
- `npm run web:smoke`

# Simulator Assertions WIP

Stopped at: simulator assertion red tests.

Last completed commit before this WIP: `cda54cf feat: add rules precheck trace`.

Current staged intent:

- Add runtime tests for simulation assertions:
  - `expectedKnownClues`
  - `expectedFlags`
  - `forbiddenOutputPhrases`
- Add CLI test proving `simulate` exits non-zero when script assertions fail.

Known current state:

- Implementation is not done yet.
- `runSimulation` does not accept `assertions`.
- CLI `simulate` still only checks `expectedEnding`.
- The new tests are expected to fail until simulator assertion support is implemented.

Next steps:

1. Add `SimulationAssertions` and `assertionFailures` to `packages/runtime/src/simulator.ts`.
2. Parse `expectedKnownClues`, `expectedFlags`, and `forbiddenOutputPhrases` in `apps/cli/src/main.ts`.
3. Update sample scripts to include successful assertions for true and wrong paths.
4. Run `npm test`, `npm run typecheck`, CLI validate/simulate/pack, and `npm run web:smoke`.

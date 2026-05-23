# AI Interactive Game Platform Design

Date: 2026-05-23
Status: Design approved in conversation; written spec pending user review

## 1. Product Positioning

This product is an AI-powered interactive tabletop and narrative game runtime with importable world packs.

It is not a generic chatbot and not a traditional visual RPG. Creators define worlds, characters, rules, clues, items, quests, endings, and safety boundaries. Players import a pack and play through natural language plus simple UI. AI provides narration and character expression, while the rules layer protects canonical facts, state, and progression.

The first version will validate an end-to-end MVP:

- Create or load a world pack.
- Validate the pack.
- Start a single-player session.
- Play through Web or CLI.
- Persist state and event logs.
- Reach endings through rule-checked conditions.

## 2. Confirmed Product Decisions

- MVP approach: end-to-end MVP, not editor-only or player-only.
- First sample genre: detective mystery.
- Interfaces: shared runtime with both Web and CLI.
- Model strategy: model provider abstraction, cloud model API by default.
- Creator audience: support both long term; MVP targets technical creators first.
- Multiplayer: architecture leaves room for multiplayer, but MVP is single-player only.
- Rule strategy: hybrid rules. Program-enforced hard constraints plus AI-generated narration.
- Agent architecture: programmatic Director Orchestrator, on-demand NPC Actor, independent Narrator, strong rules layer.

## 3. Comparable Products And Differentiation

Comparable products show demand for AI-driven interactive fiction, AI game masters, and AI NPCs, but they do not fully cover the target shape of this product.

- AI Dungeon provides AI text adventure play, Story Cards, import/export, scenarios, and scripting hooks. It is strong in open-ended AI storytelling, but its core model is still context-driven generation. This product should differentiate by making key facts, clues, endings, and state transitions machine-verifiable instead of primarily prompt-driven.
- Friends & Fables focuses on AI TTRPG campaigns, player-made worlds, an AI game master, world-building tools, and tactical 5e combat. It is close in theme, but the proposed product should focus more on open world-pack runtime, debugging tools, and creator-controlled rule harnesses.
- Inworld focuses on AI NPCs for games and developer integration. It is relevant for scoped NPC behavior and immersion, but the proposed product is not only an NPC layer; it includes pack definition, runtime state, rule validation, narrative flow, and player-facing gameplay.

Differentiation:

- AI narrative freedom plus tabletop-style hard constraints.
- Importable, inspectable, and testable world packs.
- Developer tools for validation, simulation, and trace debugging.
- Scoped NPC context rather than one all-knowing DM prompt.
- Rule-checked state patches instead of AI directly mutating game state.

Sources:

- AI Dungeon Story Cards: https://help.aidungeon.com/faq/story-cards
- AI Dungeon Scripting: https://help.aidungeon.com/scripting
- AI Dungeon Story Card Import/Export: https://help.aidungeon.com/story-cards-import-and-export
- Friends & Fables: https://fables.gg/
- Friends & Fables introduction: https://help.fables.gg/articles/9772516-introduction
- Inworld AI NPC development: https://inworld.ai/landing/ai-npc-development

## 4. MVP Player Experience

The MVP sample pack should be a compact detective case named "Rain Tower Murder". It should be small enough to author and test, but complete enough to exercise the runtime.

Required sample pack content:

- 3 locations.
- 3 NPCs.
- 6 clues.
- 2 items.
- 1 main quest with stages.
- 3 endings: true resolution, wrong accusation, unresolved failure.

Player loop:

1. Player starts a case and creates or selects a role.
2. Runtime shows current location, visible NPCs, visible objects, and active goals.
3. Player enters a natural language action or CLI command.
4. Runtime parses the action.
5. Rules Engine checks whether the action is allowed.
6. Context Router gathers only relevant unlocked context.
7. Runtime calls NPC Actor and/or Narrator only when needed.
8. Agents return player-visible text and proposed patches.
9. Patch Validator accepts or rejects state changes.
10. Output Auditor checks leakage, out-of-character text, and rule violations.
11. Session state and event trace are persisted.
12. Player continues investigating or makes an accusation.
13. Ending Judge evaluates rule-defined ending conditions.

Web UI:

- Main narrative area with turn history.
- Action input with shortcuts for inspect, ask, move, use, deduce, accuse.
- Status sidebar showing current location, time, player state, active goal, and warnings.
- Case panel with map, NPCs, clues, inventory, known facts, and deduction notes.

CLI:

```text
look
go study
ask butler "9 点你在哪里"
inspect window
clues
state
trace last
accuse npc_butler with clue_watch clue_mud
```

MVP experience goal:

The player should feel they are playing with a stable case host, not chatting with an unconstrained chatbot. AI wording may vary, but clues, secrets, state, and endings must remain stable.

## 5. World Pack Format

Use a directory-based world pack. Markdown handles narrative material; YAML handles rule-checked structure.

```text
case-rain-tower/
  manifest.yaml
  world.md
  rules.yaml
  locations.yaml
  npcs.yaml
  clues.yaml
  items.yaml
  quests.yaml
  endings.yaml
  prompts/
    narrator.md
    npc.md
    auditor.md
  assets/
    cover.png
```

File responsibilities:

- `manifest.yaml`: metadata, version, runtime compatibility, entry location, model capability hints.
- `world.md`: world background, tone, history, and style. It is narrative material, not a source of enforceable facts.
- `rules.yaml`: global action types, time rules, resources, condition expression settings, patch allowlist, failure policy.
- `locations.yaml`: locations, visible objects, hidden objects, descriptions, exits, entry conditions.
- `npcs.yaml`: public identity, private facts, motives, relationships, topics, topic unlock conditions, forbidden disclosures.
- `clues.yaml`: clue definitions, discovery conditions, display text, related entities, accusation relevance.
- `items.yaml`: items, pickup conditions, use targets, and allowed effects.
- `quests.yaml`: quest stages, triggers, completion conditions, failure conditions.
- `endings.yaml`: ending IDs, priorities, required conditions, required evidence, ending text templates.
- `prompts/`: creator-controlled style supplements. Core runtime safety and rule prompts are not replaced by packs.

Pack layers:

1. Canon facts: truth, secrets, clues, ending conditions. These must be structured and machine-verifiable.
2. Narrative material: style, setting, descriptions, character voice notes. These can be Markdown.
3. Runtime rules: condition expressions, state schema, patch types, and policy constraints.

Example condition:

```yaml
id: clue_muddy_bootprint
discoverable_when:
  all:
    - location_is: greenhouse
    - flag_true: rain_has_started
    - npc_attitude_at_least: { npc: gardener, value: 2 }
```

Example patch:

```json
{
  "type": "discover_clue",
  "clue_id": "clue_muddy_bootprint",
  "reason": "Player inspected the greenhouse floor after the rain began."
}
```

## 6. Developer Tooling

MVP developer tools should favor technical creators and runtime debuggability.

Required tools:

- Pack validator:
  - YAML/schema validation.
  - ID reference validation.
  - Condition expression validation.
  - Missing entry point detection.
  - Unreachable ending detection.
  - Orphan clue detection.

- Local preview:
  - Load a pack.
  - Start a test session.
  - Play through the shared runtime.

- Debug CLI:
  - Show current state.
  - Show known clues.
  - Show last turn trace.
  - Show precheck result.
  - Show retrieved context IDs.
  - Show agent raw output.
  - Show accepted and rejected patches.

- Simulator:
  - Run scripted player actions.
  - Assert expected state changes.
  - Assert forbidden knowledge remains hidden.
  - Assert endings can be reached.

- Pack command:
  - Build `.aipack` or zip.
  - Include manifest and validation report.

Future creator UI:

The visual editor should be a layer over the same files and schemas. It should not introduce a separate data model.

## 7. Agent And Runtime Architecture

The runtime should not use one all-knowing Director Agent that simulates every NPC. That would pollute context, increase token use, and risk leaking secrets.

MVP architecture:

- Director Orchestrator:
  - Programmatic orchestration layer, not a general LLM persona.
  - Decides which modules are needed for a turn.
  - Coordinates action parsing, rules, context, agents, auditing, and persistence.
  - Does not load all NPC data.
  - Does not speak as NPCs.

- Narrator Agent:
  - Generates non-NPC narration, environmental feedback, action consequences, and transitions.
  - Receives only current visible state, rule outcomes, and relevant unlocked narrative material.
  - Does not receive NPC secrets unless they are player-known and relevant.

- NPC Actor Agent:
  - Called only when a specific NPC is involved.
  - Receives only that NPC's scoped profile, known facts, current situation, and allowed disclosure set.
  - Produces that NPC's dialogue and proposed NPC-related patches.
  - Cannot access other NPCs' private facts unless encoded as facts this NPC knows.

- Rules Engine:
  - Highest authority for game state.
  - Checks action legality, conditions, patch validity, and endings.
  - Rejects impossible or unauthorized state changes.

- Context Router:
  - Builds minimal context by scope: location, involved NPC, visible object, known clue, active quest, recent events.
  - Prevents locked or unrelated secrets from entering model context.

- Output Auditor:
  - Checks for secret leakage, rule disclosure, system prompt disclosure, out-of-world text, and forbidden claims.
  - Can reject, retry, or request rewrite.

- Debug Assistant:
  - Developer-only helper for explaining condition failures, rejected patches, and retrieval decisions.

Turn flow:

```text
Player input
  -> Action Parser
  -> Rules Precheck
  -> Context Router
  -> Optional NPC Actor call
  -> Optional Narrator call
  -> Patch Validator
  -> Output Auditor
  -> State/Event Persistence
```

Agent output shape:

```json
{
  "narration": "玩家可见的叙事文本",
  "spoken_by": [
    { "npc_id": "npc_butler", "text": "管家的台词" }
  ],
  "proposed_patches": [
    {
      "type": "discover_clue",
      "clue_id": "clue_muddy_bootprint",
      "reason": "玩家检查了温室地面，且满足发现条件。"
    }
  ],
  "private_notes": "仅用于开发者 trace，不展示给玩家"
}
```

## 8. Memory And Retrieval

Do not put everything into a vector store. Use different storage and retrieval strategies for different knowledge classes.

- Structured state:
  - Current location.
  - Player resources.
  - Inventory.
  - Known clues.
  - Flags.
  - Quest stages.
  - NPC attitudes.
  - This must be stored in database/JSON and treated as authoritative.

- Pack document retrieval:
  - World background.
  - Location prose.
  - NPC voice notes.
  - Historical lore.
  - Use Markdown chunking plus BM25 and optionally embeddings.

- Session memory:
  - Event log is the source of truth.
  - Summaries are derived, not authoritative.
  - Retrieval should prefer scoped recent events and entity-specific summaries.

MVP memory implementation:

- SQLite for session state and event logs.
- Local JSON/BM25 index for pack text.
- Define a retrieval adapter interface, but do not require embedding retrieval in MVP.

Formal product version:

- Postgres for multi-user state.
- Postgres FTS for text search.
- pgvector for embeddings.

## 9. Technical Architecture

Use a TypeScript monorepo so schemas, types, runtime, Web UI, and CLI can share contracts.

Recommended stack:

- Frontend: Next.js and React.
- Backend API: Next.js Route Handlers for MVP; Fastify/NestJS if runtime grows separately.
- CLI: Node.js CLI.
- Schema validation: Zod and JSON Schema.
- Pack files: YAML, Markdown, JSON Schema.
- Database: SQLite for MVP, Postgres later.
- Full-text retrieval: MiniSearch/Lunr for MVP, Postgres FTS later.
- Vector retrieval: local adapter for MVP, pgvector later.
- Model layer: provider interface with cloud model API default.
- Testing: Vitest, Playwright, scripted pack simulation.

Proposed package layout:

```text
apps/web            # Player Web app and developer debug pages
apps/cli            # play, validate, simulate, inspect commands
packages/runtime    # game turn runtime
packages/pack       # pack loading, schema, validation, packaging
packages/agents     # model provider, agent calls, prompt templates
packages/rules      # conditions, patch validation, ending judgment
packages/memory     # BM25/vector/event summary retrieval
packages/shared     # shared types
```

Model provider interface:

```ts
interface ModelProvider {
  generateStructured<T>(request: {
    model: string
    system: string
    messages: RuntimeMessage[]
    schema: JsonSchema
    temperature?: number
    maxTokens?: number
  }): Promise<T>
}
```

## 10. Persistence Model

Store three categories of data:

1. Static world pack data:
   - Locations, NPCs, clues, items, quests, endings, rules.
   - Versioned and read-only during a session.

2. Session state:
   - Current location.
   - Time or turn count.
   - Player state.
   - Inventory.
   - Known clues.
   - Flags.
   - NPC attitudes.
   - Quest stages.

3. Event log:
   - Player input.
   - Parsed action.
   - Rules precheck result.
   - Context IDs loaded.
   - Agent raw output.
   - Accepted patches.
   - Rejected patches and reasons.
   - Final player-visible output.

Initial table shape:

```text
world_packs(id, name, version, path, manifest_json, created_at)
sessions(id, pack_id, player_id, current_state_json, summary_json, created_at, updated_at)
events(id, session_id, turn_no, actor, input_text, action_json, output_text, patches_json, trace_json, created_at)
memories(id, session_id, scope, entity_id, text, embedding, metadata_json)
```

Every turn must persist enough data to replay and debug the decision chain.

## 11. Hard Runtime Constraints

The LLM can propose; the rules layer decides.

Hard constraints:

- AI cannot create new canonical clues.
- AI cannot grant undiscovered clues unless discovery conditions pass.
- AI cannot change ending conditions.
- AI cannot mutate inventory, location, HP/resources, quest stages, or flags directly.
- NPC Actor cannot reveal facts outside its allowed disclosure set.
- Narrator cannot reveal NPC secrets unless already unlocked.
- Player prompt injection is treated as in-game action, not instruction to the runtime.
- All state changes must be allowlisted patch types.
- Final endings are chosen by Ending Judge, not by agent preference.

## 12. MVP Scope

Must have:

- One sample detective pack.
- Pack loader.
- Pack validator.
- Condition expressions.
- Patch types and validator.
- Single-player sessions.
- Web player interface.
- CLI play/debug interface.
- Programmatic Director Orchestrator.
- Context Router.
- Narrator Agent.
- On-demand NPC Actor Agent.
- Basic Output Auditor.
- SQLite persistence.
- Event traces.
- Scripted simulation tests.

Out of scope for MVP:

- Multiplayer sessions.
- Public world pack marketplace.
- Full visual world editor.
- Complex combat.
- Large open world.
- Autonomous NPC schedules.
- Voice, images, or complex maps.
- Multi-model automatic routing.

## 13. Implementation Phases

Phase 1: Pack and rules core

- Define schemas.
- Implement pack loading.
- Implement pack validation.
- Implement condition expression evaluator.
- Implement patch model and validation.
- Implement ending judgment.

Phase 2: Runtime turn loop

- Implement action parser.
- Implement rules precheck.
- Implement context router.
- Implement model provider abstraction.
- Implement Narrator and NPC Actor calls.
- Persist state and event trace.

Phase 3: Sample detective pack

- Author the sample pack.
- Cover locations, NPCs, clues, items, quest stages, and endings.
- Add scripted playthroughs for true and false paths.

Phase 4: CLI tools

- `validate pack`
- `play`
- `state`
- `clues`
- `trace last`
- `simulate script`

Phase 5: Web UI

- Narrative turn stream.
- Action input.
- Current location panel.
- NPC panel.
- Clue board.
- Inventory.
- Quest panel.

Phase 6: Developer debug UI

- Event list.
- Turn trace.
- Context IDs.
- Agent raw output.
- Patch acceptance/rejection.
- Rule failure explanations.

Phase 7: Verification

- Unit tests for rules.
- Pack validation tests.
- Output schema tests.
- Simulated playthrough tests.
- Web smoke tests.

## 14. Risks And Mitigations

AI leaks secrets:

- Do not place locked secrets in regular context.
- Scope NPC context by NPC and allowed disclosure.
- Audit output for sensitive facts.
- Retry or rewrite on failure.

AI invents clues:

- Only accept `discover_clue` for existing clue IDs.
- Reject unknown IDs.
- Reject discovery when conditions fail.

Prompt injection:

- Treat player text as action content only.
- Keep system and rules prompts outside player control.
- Run precheck before agent calls.

Context growth:

- Persist full event log.
- Retrieve only scoped summaries and relevant events.
- Route context by entity, location, clue, quest, and recent turns.

Creator complexity:

- Keep MVP pack schema explicit.
- Provide validation errors with actionable messages.
- Provide simulation scripts.
- Add visual editor later as a schema-backed layer.

Ending instability:

- Endings are rule-checked.
- Agent only renders ending text after Ending Judge selects ending.

## 15. Difficulty And Timeline

Technical difficulty: medium-high.

The UI is not the hard part. The hard parts are state integrity, context isolation, rule enforcement, patch validation, and debugging.

Rough estimates with a mature cloud model API:

- Playable prototype: 2 to 4 weeks.
- Stable MVP: 6 to 10 weeks.
- External creator trial: 3 to 4 months.
- Platform-grade product: 6 to 12 months or more.

## 16. MVP Success Criteria

The MVP succeeds when:

- A player can finish a 30 to 60 minute detective case in Web UI.
- A technical creator can validate and package the sample world pack.
- CLI can run scripted playthroughs and show trace output.
- Undiscovered clues and secrets remain hidden.
- Wrong accusations and true accusations resolve through rule-defined conditions.
- AI can vary narration and dialogue without breaking state, clues, secrets, or endings.

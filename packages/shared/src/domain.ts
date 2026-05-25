import { z } from "zod";

export const IdSchema = z.string().regex(/^[a-z][a-z0-9_:-]*$/);

export const ManifestSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  runtimeVersion: z.string().min(1),
  entryLocationId: IdSchema
});

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

export const LocationSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  description: z.string().min(1),
  exits: z.array(IdSchema),
  entryCondition: ConditionSchema.optional(),
  visibleObjects: z.array(IdSchema).default([])
});

export const NpcSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  publicDescription: z.string().min(1),
  privateFacts: z.array(z.string()).default([]),
  knows: z.array(z.string()).default([]),
  forbiddenDisclosures: z.array(z.string()).default([]),
  topics: z
    .array(
      z.object({
        id: IdSchema,
        prompt: z.string().min(1),
        aliases: z.array(z.string().min(1)).optional(),
        unlockCondition: ConditionSchema.optional(),
        revealsClueId: IdSchema.optional()
      })
    )
    .default([])
});

export const ClueSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  description: z.string().min(1),
  discoverableWhen: ConditionSchema.optional(),
  accusationWeight: z.number().int().min(0).default(0)
});

export const ItemSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  description: z.string().min(1),
  revealsClueId: IdSchema.optional(),
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
  endings: z.array(EndingSchema)
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
  z.object({ type: z.literal("take"), itemId: IdSchema, rawText: z.string() }),
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

export const TurnMessageSchema = z.object({
  type: z.enum(["environment", "narration", "npc", "system", "item", "clue"]),
  text: z.string().min(1),
  label: z.string().min(1).optional(),
  npcId: IdSchema.optional(),
  itemId: IdSchema.optional(),
  clueId: IdSchema.optional()
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type WorldPack = z.infer<typeof WorldPackSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type GameAction = z.infer<typeof ActionSchema>;
export type GamePatch = z.infer<typeof PatchSchema>;
export type TurnMessage = z.infer<typeof TurnMessageSchema>;
export type LocationDef = z.infer<typeof LocationSchema>;
export type NpcDef = z.infer<typeof NpcSchema>;
export type ClueDef = z.infer<typeof ClueSchema>;
export type EndingDef = z.infer<typeof EndingSchema>;

import { z } from "zod";

export const IdSchema = z.string().regex(/^[a-z][a-z0-9_:-]*$/);

export const ManifestSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  version: z.string().min(1),
  runtimeVersion: z.string().min(1),
  entryLocationId: IdSchema,
  profileId: IdSchema
});

export const ProfileActionSchema = z.object({
  aliases: z.array(z.string().min(1)).default([]),
  mapsTo: z.string().min(1).optional(),
  requiresTarget: z.enum(["character", "item", "location", "fact"]).optional(),
  acceptsFacts: z.boolean().default(false)
});

export type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { location_is: string }
  | { flag_true: string }
  | { has_item: string }
  | { knows_fact: string }
  | { factKnown: string }
  | { objective_stage_is: { objective: string; stage: string } }
  | { relationship_at_least: { character: string; value: number } }
  | { relationship_at_most: { character: string; value: number } }
  | { resource_at_least: { resource: string; value: number } }
  | { resource_at_most: { resource: string; value: number } };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ all: z.array(ConditionSchema).min(1) }),
    z.object({ any: z.array(ConditionSchema).min(1) }),
    z.object({ not: ConditionSchema }),
    z.object({ location_is: IdSchema }),
    z.object({ flag_true: IdSchema }),
    z.object({ has_item: IdSchema }),
    z.object({ knows_fact: IdSchema }),
    z.object({ factKnown: IdSchema }),
    z.object({ objective_stage_is: z.object({ objective: IdSchema, stage: z.string().min(1) }) }),
    z.object({ relationship_at_least: z.object({ character: IdSchema, value: z.number().int() }) }),
    z.object({ relationship_at_most: z.object({ character: IdSchema, value: z.number().int() }) }),
    z.object({ resource_at_least: z.object({ resource: IdSchema, value: z.number().int() }) }),
    z.object({ resource_at_most: z.object({ resource: IdSchema, value: z.number().int() }) })
  ])
);

export const ProfileSchema = z.object({
  id: IdSchema,
  labels: z.record(z.string(), z.string().min(1)).default({}),
  quickActions: z.array(z.object({
    label: z.string().min(1),
    command: z.string().min(1),
    visibleWhen: ConditionSchema.optional()
  })).default([]),
  actions: z.record(z.string(), ProfileActionSchema).default({})
});

export const LocationSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  description: z.string().min(1),
  exits: z.array(IdSchema),
  entryCondition: ConditionSchema.optional(),
  visibleObjects: z.array(IdSchema).default([]),
  visibleCharacters: z.array(IdSchema).default([])
});

export const CharacterSchema = z.object({
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
        revealsFactId: IdSchema.optional()
      })
    )
    .default([])
});

export const FactSchema = z.object({
  id: IdSchema,
  kind: z.string().min(1).default("fact"),
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  description: z.string().min(1),
  discoverableWhen: ConditionSchema.optional(),
  tags: z.array(z.string().min(1)).default([])
});

export const ItemSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  aliases: z.array(z.string().min(1)).optional(),
  description: z.string().min(1),
  revealsFactId: IdSchema.optional(),
  pickupCondition: ConditionSchema.optional()
});

export const ResourceSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  initial: z.number().int(),
  min: z.number().int(),
  max: z.number().int()
});

export const RelationshipSchema = z.object({
  characterId: IdSchema,
  name: z.string().min(1),
  initial: z.number().int(),
  min: z.number().int(),
  max: z.number().int()
});

export const ObjectiveSchema = z.object({
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

export const TimelineEventSchema = z.discriminatedUnion("kind", [
  z.object({
    id: z.string(),
    kind: z.literal("player_action"),
    text: z.string(),
    timestamp: z.string(),
    actorId: z.literal("player"),
    visibleToPlayer: z.boolean().default(true)
  }),
  z.object({
    id: z.string(),
    kind: z.literal("scene"),
    text: z.string(),
    timestamp: z.string(),
    visibleToPlayer: z.boolean().default(true)
  }),
  z.object({
    id: z.string(),
    kind: z.literal("dialogue"),
    text: z.string(),
    timestamp: z.string(),
    speakerId: IdSchema,
    speakerName: z.string(),
    visibleToPlayer: z.boolean().default(true)
  }),
  z.object({
    id: z.string(),
    kind: z.enum(["evidence", "item", "progress", "location_change", "notice", "debug"]),
    text: z.string(),
    timestamp: z.string(),
    refId: IdSchema.optional(),
    visibleToPlayer: z.boolean().default(true)
  })
]);

export const PatchSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reveal_fact"), factId: IdSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal("add_item"), itemId: IdSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal("remove_item"), itemId: IdSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal("move_location"), locationId: IdSchema, reason: z.string().min(1) }),
  z.object({ type: z.literal("set_flag"), flag: IdSchema, value: z.boolean(), reason: z.string().min(1) }),
  z.object({ type: z.literal("adjust_relationship"), characterId: IdSchema, delta: z.number().int(), reason: z.string().min(1) }),
  z.object({ type: z.literal("set_resource"), resourceId: IdSchema, value: z.number().int(), reason: z.string().min(1) }),
  z.object({ type: z.literal("adjust_resource"), resourceId: IdSchema, delta: z.number().int(), reason: z.string().min(1) }),
  z.object({ type: z.literal("set_objective_stage"), objectiveId: IdSchema, stage: z.string().min(1), reason: z.string().min(1) })
]);

export const TriggerActionSchema = z.object({
  action: z.enum(["look", "move", "inspect", "talk", "take", "use", "act", "unknown"]),
  intent: z.string().min(1).optional(),
  targetId: IdSchema.optional(),
  characterId: IdSchema.optional(),
  itemId: IdSchema.optional(),
  locationId: IdSchema.optional(),
  factIds: z.array(IdSchema).optional()
});

export const RuleTriggerSchema = z.object({
  id: IdSchema,
  on: TriggerActionSchema,
  when: ConditionSchema.optional(),
  unless: ConditionSchema.optional(),
  patches: z.array(PatchSchema).default([])
});

export const RulesSchema = z.object({
  allowedPatchTypes: z.array(z.string()).min(1),
  triggers: z.array(RuleTriggerSchema).default([])
});

export const WorldPackSchema = z.object({
  manifest: ManifestSchema,
  worldText: z.string(),
  profile: ProfileSchema,
  rules: RulesSchema,
  locations: z.array(LocationSchema),
  characters: z.array(CharacterSchema),
  facts: z.array(FactSchema),
  items: z.array(ItemSchema),
  resources: z.array(ResourceSchema),
  relationships: z.array(RelationshipSchema),
  objectives: z.array(ObjectiveSchema),
  endings: z.array(EndingSchema)
});

export const SessionStateSchema = z.object({
  currentLocationId: IdSchema,
  turn: z.number().int().min(0),
  inventory: z.array(IdSchema).default([]),
  knownFacts: z.array(IdSchema).default([]),
  resources: z.record(z.string(), z.number().int()).default({}),
  relationships: z.record(z.string(), z.number().int()).default({}),
  flags: z.record(z.string(), z.boolean()).default({}),
  objectiveStages: z.record(z.string(), z.string()).default({}),
  lastInterlocutorId: IdSchema.optional(),
  packId: IdSchema.optional()
});

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("look"), rawText: z.string() }),
  z.object({ type: z.literal("inspect"), targetId: IdSchema, query: z.string().optional(), rawText: z.string() }),
  z.object({ type: z.literal("move"), locationId: IdSchema, rawText: z.string() }),
  z.object({ type: z.literal("talk"), characterId: IdSchema, targetId: IdSchema.optional(), topic: z.string().min(1), rawText: z.string() }),
  z.object({ type: z.literal("group_talk"), topic: z.string().min(1).optional(), rawText: z.string() }),
  z.object({ type: z.literal("take"), itemId: IdSchema, rawText: z.string() }),
  z.object({ type: z.literal("use"), itemId: IdSchema, targetId: IdSchema.optional(), rawText: z.string() }),
  z.object({
    type: z.literal("act"),
    intent: z.string().min(1),
    targetId: IdSchema.optional(),
    itemId: IdSchema.optional(),
    locationId: IdSchema.optional(),
    factIds: z.array(IdSchema).default([]),
    rawText: z.string()
  }),
  z.object({ type: z.literal("unknown"), rawText: z.string() })
]);

export const TurnMessageSchema = z.object({
  type: z.enum(["environment", "narration", "character", "system", "item", "fact"]),
  text: z.string().min(1),
  label: z.string().min(1).optional(),
  characterId: IdSchema.optional(),
  itemId: IdSchema.optional(),
  factId: IdSchema.optional()
});

export type Manifest = z.infer<typeof ManifestSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type WorldPack = z.infer<typeof WorldPackSchema>;
export type SessionState = z.infer<typeof SessionStateSchema>;
export type GameAction = z.infer<typeof ActionSchema>;
export type GamePatch = z.infer<typeof PatchSchema>;
export type TimelineEvent = z.infer<typeof TimelineEventSchema>;
export type RuleTrigger = z.infer<typeof RuleTriggerSchema>;
export type TurnMessage = z.infer<typeof TurnMessageSchema>;
export type LocationDef = z.infer<typeof LocationSchema>;
export type CharacterDef = z.infer<typeof CharacterSchema>;
export type FactDef = z.infer<typeof FactSchema>;
export type ItemDef = z.infer<typeof ItemSchema>;
export type ResourceDef = z.infer<typeof ResourceSchema>;
export type RelationshipDef = z.infer<typeof RelationshipSchema>;
export type ObjectiveDef = z.infer<typeof ObjectiveSchema>;
export type EndingDef = z.infer<typeof EndingSchema>;

export function createInitialSessionState(pack: WorldPack): SessionState {
  return {
    currentLocationId: pack.manifest.entryLocationId,
    turn: 0,
    inventory: [],
    knownFacts: [],
    resources: Object.fromEntries(pack.resources.map((resource) => [resource.id, resource.initial])),
    relationships: Object.fromEntries(pack.relationships.map((relationship) => [relationship.characterId, relationship.initial])),
    flags: {},
    objectiveStages: Object.fromEntries(pack.objectives.map((objective) => [objective.id, objective.initialStage]))
  };
}

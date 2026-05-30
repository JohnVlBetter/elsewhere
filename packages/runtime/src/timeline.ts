import { randomUUID } from "node:crypto";
import type { GamePatch, TimelineEvent, TurnMessage, WorldPack } from "@aigame/shared";

export function buildTimelineEvents(input: {
  command: string;
  timestamp: string;
  messages: TurnMessage[];
  patches: GamePatch[];
  pack?: WorldPack;
}): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      id: randomUUID(),
      kind: "player_action",
      actorId: "player",
      text: input.command,
      timestamp: input.timestamp,
      visibleToPlayer: true
    }
  ];

  for (const message of input.messages) {
    const event = messageToTimelineEvent(message, input.timestamp);
    if (event) events.push(event);
  }

  for (const patch of input.patches) {
    const event = patchToTimelineEvent(patch, input.timestamp, input.pack);
    if (event) events.push(event);
  }

  return events;
}

function messageToTimelineEvent(message: TurnMessage, timestamp: string): TimelineEvent | undefined {
  if (message.type === "environment" || message.type === "narration") {
    return {
      id: randomUUID(),
      kind: "scene",
      text: message.text,
      timestamp,
      visibleToPlayer: true,
      metadata: { messageType: message.type }
    };
  }

  if (message.type === "character" && message.characterId) {
    return {
      id: randomUUID(),
      kind: "dialogue",
      speakerId: message.characterId,
      speakerName: message.label ?? message.characterId,
      text: message.text,
      timestamp,
      visibleToPlayer: true
    };
  }

  if (message.type === "fact") {
    return {
      id: randomUUID(),
      kind: "evidence",
      refId: message.factId,
      text: formatLabelledText(message.label, message.text),
      timestamp,
      visibleToPlayer: true
    };
  }

  if (message.type === "item") {
    return {
      id: randomUUID(),
      kind: "item",
      refId: message.itemId,
      text: formatLabelledText(message.label, message.text),
      timestamp,
      visibleToPlayer: true
    };
  }

  if (message.type === "system") {
    return { id: randomUUID(), kind: "notice", text: message.text, timestamp, visibleToPlayer: true };
  }

  return undefined;
}

function patchToTimelineEvent(patch: GamePatch, timestamp: string, pack: WorldPack | undefined): TimelineEvent | undefined {
  if (patch.type === "move_location") {
    const locationName = pack?.locations.find((location) => location.id === patch.locationId)?.name ?? patch.locationId;
    return {
      id: randomUUID(),
      kind: "location_change",
      refId: patch.locationId,
      text: `来到：${locationName}`,
      timestamp,
      visibleToPlayer: true
    };
  }

  if (patch.type === "set_objective_stage") {
    const objectiveName = pack?.objectives.find((objective) => objective.id === patch.objectiveId)?.name ?? patch.objectiveId;
    return {
      id: randomUUID(),
      kind: "progress",
      refId: patch.objectiveId,
      text: `${objectiveName}：${patch.stage}`,
      timestamp,
      visibleToPlayer: true
    };
  }

  if (patch.type === "adjust_relationship") {
    const relationshipName = pack?.relationships.find((relationship) => relationship.characterId === patch.characterId)?.name ?? patch.characterId;
    return {
      id: randomUUID(),
      kind: "relationship",
      refId: patch.characterId,
      text: `${relationshipName} ${formatSignedDelta(patch.delta)}`,
      timestamp,
      visibleToPlayer: true
    };
  }

  if (patch.type === "adjust_resource") {
    const resourceName = pack?.resources.find((resource) => resource.id === patch.resourceId)?.name ?? patch.resourceId;
    return {
      id: randomUUID(),
      kind: "resource",
      refId: patch.resourceId,
      text: `${resourceName} ${formatSignedDelta(patch.delta)}`,
      timestamp,
      visibleToPlayer: true
    };
  }

  if (patch.type === "set_resource") {
    const resourceName = pack?.resources.find((resource) => resource.id === patch.resourceId)?.name ?? patch.resourceId;
    return {
      id: randomUUID(),
      kind: "resource",
      refId: patch.resourceId,
      text: `${resourceName} = ${patch.value}`,
      timestamp,
      visibleToPlayer: true
    };
  }

  return undefined;
}

function formatLabelledText(label: string | undefined, text: string): string {
  return label ? `${label} - ${text}` : text;
}

function formatSignedDelta(delta: number): string {
  return delta >= 0 ? `+${delta}` : String(delta);
}

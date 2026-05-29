import type { TimelineEvent } from "@aigame/shared";

export function isPlayerVisibleTimelineEvent(event: TimelineEvent): boolean {
  return event.kind !== "debug" && event.visibleToPlayer !== false;
}

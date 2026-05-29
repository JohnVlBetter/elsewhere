import type { TimelineEvent } from "@aigame/shared";
import { isPlayerVisibleTimelineEvent } from "../timelineVisibility";

export function toPlayerTurnResult<T extends { timelineEvents: TimelineEvent[] }>(
  result: T
): Omit<T, "timelineEvents"> & { timelineEvents: TimelineEvent[] } {
  return {
    ...result,
    timelineEvents: result.timelineEvents.filter(isPlayerVisibleTimelineEvent)
  };
}

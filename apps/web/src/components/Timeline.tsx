import type { TimelineEvent } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { TimelineEventView } from "./TimelineEventView";

export function Timeline({ events, entityMaps }: { events: TimelineEvent[]; entityMaps: EntityMaps }) {
  return (
    <section className="timeline" aria-label="故事记录">
      {events.length === 0 ? <p className="timeline__empty">故事正在开始。</p> : null}
      {events.map((event) => (
        <TimelineEventView key={event.id} event={event} entityMaps={entityMaps} />
      ))}
    </section>
  );
}

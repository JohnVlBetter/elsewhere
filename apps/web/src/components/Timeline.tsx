import type { TimelineEvent } from "@aigame/shared";
import { TimelineEventView } from "./TimelineEventView";

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <section className="timeline" aria-label="故事记录">
      {events.map((event) => (
        <TimelineEventView key={event.id} event={event} />
      ))}
    </section>
  );
}

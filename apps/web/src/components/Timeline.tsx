import type { TimelineEvent } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { TimelineEventView } from "./TimelineEventView";

export function Timeline({ events, entityMaps }: { events: TimelineEvent[]; entityMaps: EntityMaps }) {
  return (
    <section className="timeline order-2 grid min-h-[420px] content-start gap-4 overflow-auto rounded-lg bg-[var(--reader-bg)] p-4 shadow-[inset_0_0_0_1px_var(--line)] sm:p-6 lg:col-start-1 lg:row-start-2 lg:min-h-0" aria-label="故事记录" data-testid="timeline">
      {events.length === 0 ? <p className="timeline__empty m-0 text-[var(--muted)]">故事正在开始。</p> : null}
      {events.map((event) => (
        <TimelineEventView key={event.id} event={event} entityMaps={entityMaps} />
      ))}
    </section>
  );
}

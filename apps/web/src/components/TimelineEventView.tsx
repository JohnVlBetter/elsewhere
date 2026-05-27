import type { TimelineEvent } from "@aigame/shared";

export function TimelineEventView({ event }: { event: TimelineEvent }) {
  if (event.kind === "dialogue") {
    return (
      <article className="timeline-event timeline-event--dialogue" data-event-kind={event.kind}>
        <strong>{event.speakerName}</strong>
        <p>{event.text}</p>
      </article>
    );
  }

  if (event.kind === "player_action") {
    return (
      <article className="timeline-event timeline-event--player_action" data-event-kind={event.kind}>
        <p>{event.text}</p>
      </article>
    );
  }

  return (
    <article className={`timeline-event timeline-event--${event.kind}`} data-event-kind={event.kind}>
      <p>{event.text}</p>
    </article>
  );
}

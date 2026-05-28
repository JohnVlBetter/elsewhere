import type { TimelineEvent } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { cssUrl, normalizeTimelineEvent } from "./packVisuals";

export function TimelineEventView({ event, entityMaps }: { event: TimelineEvent; entityMaps: EntityMaps }) {
  const view = normalizeTimelineEvent(event, entityMaps);

  if (view.kind === "scene") {
    return (
      <article className="timeline-event timeline-event--scene" data-event-kind={view.kind}>
        <p>{view.text}</p>
      </article>
    );
  }

  if (view.kind === "dialogue") {
    return (
      <article className="timeline-event timeline-event--dialogue" data-event-kind={view.kind}>
        <div className="timeline-event__avatar" data-has-image={Boolean(view.avatar)} style={view.avatar ? { backgroundImage: cssUrl(view.avatar) } : undefined} aria-hidden="true" />
        <div>
          <strong>{view.title}</strong>
          <p>{view.text}</p>
        </div>
      </article>
    );
  }

  if (view.kind === "player_action") {
    return (
      <article className="timeline-event timeline-event--player_action" data-event-kind={view.kind}>
        <p>{view.text}</p>
      </article>
    );
  }

  return (
    <article className={`timeline-event timeline-event--${view.kind}`} data-event-kind={view.kind}>
      {view.title ? <strong>{view.title}</strong> : null}
      <p>{view.text}</p>
    </article>
  );
}

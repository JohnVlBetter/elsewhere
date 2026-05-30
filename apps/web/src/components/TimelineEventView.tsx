import type { ComponentType } from "react";
import type { LucideProps } from "lucide-react";
import { CircleAlert, Gem, Handshake, MapPin, MessageCircle, Package, Search, Target } from "lucide-react";
import type { TimelineEvent } from "@aigame/shared";
import type { EntityMaps } from "./entityLabels";
import { cssUrl, normalizeTimelineEvent } from "./packVisuals";

const EVENT_ICONS: Partial<Record<TimelineEvent["kind"], ComponentType<LucideProps>>> = {
  dialogue: MessageCircle,
  evidence: Search,
  item: Package,
  progress: Target,
  location_change: MapPin,
  relationship: Handshake,
  resource: Gem,
  notice: CircleAlert
};

export function TimelineEventView({ event, entityMaps }: { event: TimelineEvent; entityMaps: EntityMaps }) {
  const view = normalizeTimelineEvent(event, entityMaps);
  const avatarImage = view.avatar ? cssUrl(view.avatar) : undefined;
  const Icon = EVENT_ICONS[view.kind];

  if (view.kind === "scene") {
    const role = view.role ?? "narration";
    return (
      <article className={`timeline-event timeline-event--scene timeline-event--${role} max-w-3xl px-1 py-2 text-[1.04rem] leading-8 text-[var(--ink)]`} data-event-kind={view.kind} data-event-role={role}>
        <p className="m-0 [overflow-wrap:anywhere]">{view.text}</p>
      </article>
    );
  }

  if (view.kind === "dialogue") {
    return (
      <article className="timeline-event timeline-event--dialogue grid max-w-3xl grid-cols-[44px_minmax(0,1fr)] gap-3 rounded-lg border border-[var(--line)] bg-white p-3 shadow-[0_10px_26px_rgba(39,34,28,0.06)]" data-event-kind={view.kind}>
        <div className="timeline-event__avatar h-11 w-11 rounded-full border border-[rgba(82,104,122,0.22)] bg-[linear-gradient(145deg,var(--story-accent),#d7dde3)] bg-cover bg-center" data-has-image={Boolean(avatarImage)} style={avatarImage ? { backgroundImage: avatarImage } : undefined} aria-hidden="true" />
        <div className="min-w-0">
          <strong className="mb-1 flex items-center gap-2 text-[var(--accent-strong)]">
            {Icon ? <Icon className="h-4 w-4" aria-hidden="true" data-testid="timeline-event-icon" /> : null}
            {view.title}
          </strong>
          <p className="m-0 [overflow-wrap:anywhere] leading-7">{view.text}</p>
        </div>
      </article>
    );
  }

  if (view.kind === "player_action") {
    return (
      <article className="timeline-event timeline-event--player_action ml-auto max-w-2xl rounded-lg border border-[rgba(82,104,122,0.28)] bg-[#eef3f7] px-4 py-2 text-[var(--ink)] shadow-[0_8px_22px_rgba(47,80,104,0.08)]" data-event-kind={view.kind}>
        <p className="m-0 [overflow-wrap:anywhere] leading-7">{view.text}</p>
      </article>
    );
  }

  return (
    <article className={`timeline-event timeline-event--${view.kind} grid max-w-3xl grid-cols-[32px_minmax(0,1fr)] gap-3 rounded-lg border border-[var(--line)] bg-white p-3 shadow-[0_10px_26px_rgba(39,34,28,0.06)]`} data-event-kind={view.kind}>
      <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-md bg-[rgba(82,104,122,0.1)] text-[var(--accent-strong)]">
        {Icon ? <Icon className="h-4 w-4" aria-hidden="true" data-testid="timeline-event-icon" /> : null}
      </span>
      <div className="min-w-0">
        {view.title ? <strong className="mb-1 block text-[var(--accent-strong)]">{view.title}</strong> : null}
        <p className="m-0 [overflow-wrap:anywhere] leading-7">{view.text}</p>
      </div>
    </article>
  );
}

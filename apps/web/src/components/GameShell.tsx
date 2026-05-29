"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Activity, BookOpen, Clock, MapPin } from "lucide-react";
import type { Manifest, Profile, SessionState, TimelineEvent } from "@aigame/shared";
import { ActionComposer } from "./ActionComposer";
import { DebugDrawer } from "./DebugDrawer";
import { buildEntityMaps, labelEntity } from "./entityLabels";
import type { EntitySummary, ObjectiveSummary } from "./entityLabels";
import { resolveStoryVisuals } from "./packVisuals";
import type { StoryVisualSource } from "./packVisuals";
import { StateSidebar } from "./StateSidebar";
import { isPlayerVisibleTimelineEvent } from "../timelineVisibility";
import { Timeline } from "./Timeline";
import { readTurnEventStream } from "./turnStream";

export type SessionResponse = {
  sessionId: string;
  packId: string;
  manifest: Manifest;
  profile: Profile;
  entities: {
    locations: EntitySummary[];
    characters: EntitySummary[];
    items: EntitySummary[];
    facts: EntitySummary[];
    resources?: EntitySummary[];
    relationships?: EntitySummary[];
    objectives: ObjectiveSummary[];
  };
  state: SessionState;
  intro?: string;
};

type TurnResponse = {
  outputText: string;
  timelineEvents?: TimelineEvent[];
  state: SessionState;
  acceptedPatches: unknown[];
  rejectedPatches: unknown[];
  trace: Record<string, unknown>;
};

const WAITING_TEXT = "文字正在延展";
const READY_TEXT = "准备继续";

export function GameShell({ packId }: { packId: string }) {
  const [session, setSession] = useState<SessionResponse>();
  const [state, setState] = useState<SessionState>();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState(READY_TEXT);
  const [trace, setTrace] = useState<unknown>();
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const entityMaps = useMemo(() => buildEntityMaps(session?.entities), [session]);
  const labels = useMemo(() => resolveLabels(session?.profile.labels), [session]);
  const storyVisuals = useMemo(() => session ? resolveStoryVisuals(toStoryVisualSource(session)) : undefined, [session]);
  const quickActions = useMemo(
    () => (session?.profile.quickActions ?? []).filter((action) => conditionMatches(action.visibleWhen, state)),
    [session, state]
  );

  useEffect(() => {
    setStatus("载入故事");
    setError(undefined);
    void fetch("/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ packId })
    })
      .then((response) => {
        if (!response.ok) throw new Error("session api failed");
        return response.json() as Promise<SessionResponse>;
      })
      .then((body) => {
        setSession(body);
        setState(body.state);
        setTrace(undefined);
        setStatus(READY_TEXT);
        setEvents(body.intro ? [createLocalSceneEvent(body.intro)] : []);
      })
      .catch(() => {
        setError("没能载入这个故事。");
        setStatus("连接失败");
      });
  }, [packId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const command = input.trim();
    if (!command || !session?.sessionId || isSubmitting) return;

    setIsSubmitting(true);
    setInput("");
    setStatus(WAITING_TEXT);

    try {
      const response = await fetch("/api/turn/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, inputText: command })
      });
      const body = await readTurnEventStream<TurnResponse>(response, {
        onStatus: (message) => setStatus(message)
      });
      setState(body.state);
      setTrace(body.trace);
      setEvents((current) => [
        ...current,
        ...visibleTimelineEvents(body, command)
      ]);
      setStatus(READY_TEXT);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "行动处理失败。";
      setError(message);
      setInput(command);
      setStatus("请重试");
      setEvents((current) => [...current, createLocalNoticeEvent(message)]);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="game-shell grid min-h-screen grid-cols-1 gap-4 bg-[var(--page-bg)] p-3 text-[var(--ink)] lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)] lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:p-5" style={storyVisuals?.cssVars} data-testid="game-shell">
      <header className="game-header relative order-1 col-span-full overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--story-bg)] bg-cover bg-center p-4 text-[var(--story-text)] shadow-[0_18px_48px_rgba(39,34,28,0.1)]" style={storyVisuals?.bannerStyle} data-has-banner={storyVisuals?.hasBannerImage ?? false}>
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.92),rgba(255,255,255,0.68))]" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="eyebrow mb-1 flex items-center gap-2 text-sm font-bold text-[var(--accent-strong)]">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              故事
            </p>
            <h1 className="text-2xl font-bold leading-tight sm:text-3xl">{session?.manifest.name ?? "载入故事"}</h1>
          </div>
          <dl className="game-header__meta grid gap-2 sm:grid-cols-3" aria-label="故事状态">
            <div className="rounded-md border border-[var(--line)] bg-white/[0.88] px-3 py-2" data-testid="story-stat">
              <dt className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {labels.location}
              </dt>
              <dd className="mt-1 font-bold [overflow-wrap:anywhere]">{state ? labelEntity(entityMaps.locations, state.currentLocationId) : "..."}</dd>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-white/[0.88] px-3 py-2" data-testid="story-stat">
              <dt className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                <Clock className="h-4 w-4" aria-hidden="true" />
                回合
              </dt>
              <dd className="mt-1 font-bold">{state?.turn ?? 0}</dd>
            </div>
            <div className="rounded-md border border-[var(--line)] bg-white/[0.88] px-3 py-2" data-testid="story-stat">
              <dt className="flex items-center gap-2 text-xs font-semibold text-[var(--muted)]">
                <Activity className="h-4 w-4" aria-hidden="true" />
                状态
              </dt>
              <dd className="mt-1 font-bold [overflow-wrap:anywhere]">{status}</dd>
            </div>
          </dl>
        </div>
      </header>

      {error ? <p className="notice order-2 col-span-full rounded-lg border border-[rgba(169,75,67,0.24)] bg-[rgba(169,75,67,0.08)] px-3 py-2 text-[var(--danger)]" role="status">{error}</p> : null}

      <Timeline events={events} entityMaps={entityMaps} />

      <ActionComposer
        input={input}
        isReady={Boolean(session?.sessionId)}
        isSubmitting={isSubmitting}
        quickActions={quickActions}
        onInputChange={setInput}
        onQuickAction={(command) => setInput(command)}
        onSubmit={submit}
      />

      <StateSidebar state={state} labels={labels} entityMaps={entityMaps} />

      <DebugDrawer trace={trace} />
    </main>
  );
}

function visibleTimelineEvents(body: TurnResponse, command: string): TimelineEvent[] {
  if (body.timelineEvents?.length) {
    return body.timelineEvents.filter(isPlayerVisibleTimelineEvent);
  }

  return [createLocalSceneEvent(body.outputText || command)];
}

function createLocalSceneEvent(text: string): TimelineEvent {
  return {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    kind: "scene",
    text,
    timestamp: new Date().toISOString(),
    visibleToPlayer: true
  };
}

function createLocalNoticeEvent(text: string): TimelineEvent {
  return {
    id: `local_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    kind: "notice",
    text,
    timestamp: new Date().toISOString(),
    visibleToPlayer: true
  };
}

function resolveLabels(labels: Record<string, string> | undefined) {
  return {
    location: labels?.location ?? "地点",
    characters: labels?.characters ?? "角色",
    facts: labels?.facts ?? "发现",
    inventory: labels?.inventory ?? "物品",
    resources: labels?.resources ?? "资源",
    relationships: labels?.relationships ?? "关系",
    objectives: labels?.objectives ?? "进展"
  };
}

function toStoryVisualSource(session: SessionResponse): StoryVisualSource {
  const profileVisuals = session.profile as Pick<StoryVisualSource, "theme" | "assets">;
  return {
    id: session.manifest.id,
    title: session.manifest.name,
    subtitle: session.profile.id,
    introduction: session.intro ?? "",
    version: session.manifest.version,
    theme: profileVisuals.theme,
    assets: profileVisuals.assets
  };
}

function conditionMatches(condition: unknown, state: SessionState | undefined): boolean {
  if (!condition || !state) return !condition;
  if (!isRecord(condition)) return false;
  if (typeof condition.factKnown === "string") return state.knownFacts.includes(condition.factKnown);
  if (typeof condition.knows_fact === "string") return state.knownFacts.includes(condition.knows_fact);
  if (typeof condition.has_item === "string") return state.inventory.includes(condition.has_item);
  if (typeof condition.flag_true === "string") return state.flags[condition.flag_true] === true;
  if (typeof condition.location_is === "string") return state.currentLocationId === condition.location_is;
  if (Array.isArray(condition.all)) return condition.all.every((part) => conditionMatches(part, state));
  if (Array.isArray(condition.any)) return condition.any.some((part) => conditionMatches(part, state));
  if ("not" in condition) return !conditionMatches(condition.not, state);
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

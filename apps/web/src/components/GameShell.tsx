"use client";

import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import type { Manifest, Profile, SessionState } from "@aigame/shared";
import { readTurnEventStream } from "./turnStream";

type StoryTone = "scene" | "player" | "narrator" | "environment" | "character" | "system" | "pending" | "item" | "fact";

type StoryEntry = {
  id: number;
  tone: StoryTone;
  text: string;
  label?: string;
};

type EntitySummary = {
  id: string;
  name: string;
};

type ObjectiveSummary = EntitySummary & {
  stages: string[];
};

type SessionResponse = {
  sessionId: string;
  packId: string;
  manifest: Manifest;
  profile: Profile;
  entities: {
    locations: EntitySummary[];
    characters: EntitySummary[];
    items: EntitySummary[];
    facts: EntitySummary[];
    objectives: ObjectiveSummary[];
  };
  state: SessionState;
  intro?: string;
};

type TurnMessage = {
  type: "environment" | "narration" | "character" | "system" | "item" | "fact";
  text: string;
  label?: string;
  characterId?: string;
  itemId?: string;
  factId?: string;
};

type TracePayload = {
  contextIds?: string[];
  agentRole?: string;
  modelName?: string;
  precheck?: { ok?: boolean; reason?: string };
  agentRawOutput?: { narration?: string; privateNotes?: string };
};

type TurnResponse = {
  outputText: string;
  messages?: TurnMessage[];
  state: SessionState;
  acceptedPatches: unknown[];
  rejectedPatches: unknown[];
  trace: TracePayload;
};

type ResolvedLabels = {
  location: string;
  characters: string;
  facts: string;
  inventory: string;
  resources: string;
  relationships: string;
  objectives: string;
};

type EntityMaps = {
  locations: Map<string, string>;
  characters: Map<string, string>;
  items: Map<string, string>;
  facts: Map<string, string>;
  objectives: Map<string, ObjectiveSummary>;
};

const INITIAL_STORY: StoryEntry = {
  id: 1,
  tone: "scene",
  text: "Loading world..."
};

const WAITING_TEXT = "Waiting for response...";
const TURN_TIMEOUT_MS = 45_000;

export function GameShell() {
  const [turns, setTurns] = useState<StoryEntry[]>([INITIAL_STORY]);
  const [input, setInput] = useState("");
  const [session, setSession] = useState<SessionResponse | undefined>();
  const [state, setState] = useState<SessionState | undefined>();
  const [trace, setTrace] = useState("No action submitted yet.");
  const [sessionError, setSessionError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextStoryId = useRef(INITIAL_STORY.id + 1);
  const storyLogRef = useRef<HTMLDivElement>(null);

  const labels = useMemo(() => resolveLabels(session?.profile.labels), [session]);
  const entityMaps = useMemo(() => buildEntityMaps(session?.entities), [session]);
  const quickActions = session?.profile.quickActions ?? [];

  function createStoryEntry(tone: StoryTone, text: string, label?: string): StoryEntry {
    const entry = { id: nextStoryId.current, tone, text, label };
    nextStoryId.current += 1;
    return entry;
  }

  useEffect(() => {
    void fetch("/api/session", { method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error("Session API failed");
        return response.json();
      })
      .then((body: SessionResponse) => {
        setSession(body);
        setState(body.state);
        setTurns([{ ...INITIAL_STORY, text: body.intro ?? INITIAL_STORY.text }]);
        nextStoryId.current = INITIAL_STORY.id + 1;
        setSessionError(undefined);
      })
      .catch(() => {
        setSessionError("Session API is unavailable.");
        setTrace("Session API unavailable; cannot load world.");
      });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const actionInput = resolveActionInput(input, quickActions);
    if (!actionInput.command || !session?.sessionId || isSubmitting) return;

    setIsSubmitting(true);
    setInput("");
    setTrace("Action sent; waiting for response.");
    const playerEntry = createStoryEntry("player", actionInput.displayText);
    const pendingEntry = createStoryEntry("pending", WAITING_TEXT);
    setTurns((current) => [
      ...current,
      playerEntry,
      pendingEntry
    ]);

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), TURN_TIMEOUT_MS);

    try {
      const response = await fetch("/api/turn/stream", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.sessionId, inputText: actionInput.command }),
        signal: controller.signal
      });

      const body = await readTurnEventStream<TurnResponse>(response, {
        onStatus: (message) => {
          setTrace(message);
          updateStoryEntry(pendingEntry.id, message);
        }
      });
      setState(body.state);
      setTrace(formatTraceSummary(body, entityMaps));
      replaceStoryEntry(pendingEntry.id, storyEntriesFromTurnResponse(body, labels, entityMaps));
    } catch (error) {
      const isTimeout = isAbortError(error);
      const message = isTimeout
        ? "Response timed out. The previous input was kept so you can retry."
        : formatSubmitFailure(error);
      setTrace(message);
      setInput(actionInput.displayText);
      replaceStoryEntry(pendingEntry.id, [{ tone: "system", text: message }]);
    } finally {
      window.clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  }

  function replaceStoryEntry(entryId: number, replacements: Array<Omit<StoryEntry, "id">>) {
    const entries = replacements.map((replacement) => createStoryEntry(replacement.tone, replacement.text, replacement.label));
    setTurns((current) =>
      current.flatMap((entry) => entry.id === entryId ? entries : [entry])
    );
  }

  function updateStoryEntry(entryId: number, text: string) {
    setTurns((current) =>
      current.map((entry) => entry.id === entryId ? { ...entry, text } : entry)
    );
  }

  useEffect(() => {
    const log = storyLogRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [turns]);

  return (
    <main className="game-shell">
      <section className="game-board" aria-label="World interface">
        <HeroPanel
          session={session}
          state={state}
          labels={labels}
          entityMaps={entityMaps}
          sessionError={sessionError}
        />
        <StoryLog turns={turns} storyLogRef={storyLogRef} />
        <ActionComposer
          input={input}
          isSubmitting={isSubmitting}
          isReady={Boolean(session?.sessionId)}
          quickActions={quickActions}
          onInputChange={setInput}
          onQuickAction={setInput}
          onSubmit={submit}
        />
      </section>

      <aside className="case-sidebar" aria-label="World side panel">
        <StatePanel state={state} labels={labels} entityMaps={entityMaps} />
        <CollectionPanel
          title={labels.facts}
          headingId="known-facts-heading"
          items={state?.knownFacts ?? []}
          emptyText={`No ${labels.facts.toLowerCase()} yet.`}
          labelFor={(id) => labelEntity(entityMaps.facts, id)}
        />
        <CollectionPanel
          title={labels.inventory}
          headingId="inventory-heading"
          items={state?.inventory ?? []}
          emptyText="Inventory is empty."
          labelFor={(id) => labelEntity(entityMaps.items, id)}
        />
        <KeyValuePanel title={labels.resources} headingId="resources-heading" rows={formatRecordRows(state?.resources)} />
        <KeyValuePanel
          title={labels.relationships}
          headingId="relationships-heading"
          rows={formatRelationshipRows(state?.relationships, entityMaps)}
        />
        <ObjectivePanel state={state} labels={labels} entityMaps={entityMaps} />
        <TracePanel trace={trace} />
      </aside>
    </main>
  );
}

function HeroPanel({
  session,
  state,
  labels,
  entityMaps,
  sessionError
}: {
  session: SessionResponse | undefined;
  state: SessionState | undefined;
  labels: ResolvedLabels;
  entityMaps: EntityMaps;
  sessionError: string | undefined;
}) {
  const locationName = state ? labelEntity(entityMaps.locations, state.currentLocationId) : "Loading";
  const objectiveSummary = formatObjectiveSummary(state, entityMaps);

  return (
    <header className="hero-panel">
      <div>
        <p className="eyebrow">{session?.profile.id ?? "profile"}</p>
        <h1>{session?.manifest.name ?? "Interactive World"}</h1>
        <p className="hero-copy">A profile-driven world runtime for facts, resources, relationships, objectives, and genre actions.</p>
      </div>
      <dl className="hero-stats" aria-label="World status summary">
        <div>
          <dt>Turn</dt>
          <dd>{state?.turn ?? 0}</dd>
        </div>
        <div>
          <dt>{labels.location}</dt>
          <dd>{locationName}</dd>
        </div>
        <div>
          <dt>{labels.objectives}</dt>
          <dd>{objectiveSummary}</dd>
        </div>
      </dl>
      {sessionError ? <p className="notice" role="status">{sessionError}</p> : null}
    </header>
  );
}

function StoryLog({ turns, storyLogRef }: { turns: StoryEntry[]; storyLogRef: RefObject<HTMLDivElement | null> }) {
  return (
    <section className="story-panel" aria-labelledby="story-heading">
      <div className="panel-heading">
        <p className="eyebrow">Log</p>
        <h2 id="story-heading">Current Story</h2>
      </div>
      <div className="story-log" aria-live="polite" ref={storyLogRef}>
        {turns.map((turn) => (
          <article className={`story-entry story-entry--${turn.tone}`} key={turn.id}>
            <span className="story-marker">{storyMarker(turn.tone)}</span>
            <div className="story-body">
              {turn.label ? <span className="story-label">{turn.label}</span> : null}
              <p>{turn.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ActionComposer({
  input,
  isSubmitting,
  isReady,
  quickActions,
  onInputChange,
  onQuickAction,
  onSubmit
}: {
  input: string;
  isSubmitting: boolean;
  isReady: boolean;
  quickActions: Profile["quickActions"];
  onInputChange: (value: string) => void;
  onQuickAction: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const statusText = isSubmitting ? "Waiting for response" : isReady ? "Ready" : "Connecting";

  return (
    <form onSubmit={onSubmit} className="action-composer">
      <div className="composer-label-row">
        <label htmlFor="action-input">Action command</label>
        <span role="status" aria-live="polite">{statusText}</span>
      </div>
      <div className="action-row">
        <input
          id="action-input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="Try: look, talk lin about lunch"
          autoComplete="off"
          disabled={!isReady || isSubmitting}
        />
        <button type="submit" disabled={!input.trim() || !isReady || isSubmitting}>
          {isSubmitting ? "Waiting" : "Send"}
        </button>
      </div>
      <QuickActions disabled={!isReady || isSubmitting} quickActions={quickActions} onPick={onQuickAction} />
    </form>
  );
}

function QuickActions({
  disabled,
  quickActions,
  onPick
}: {
  disabled: boolean;
  quickActions: Profile["quickActions"];
  onPick: (value: string) => void;
}) {
  if (quickActions.length === 0) return null;

  return (
    <div className="quick-actions" aria-label="Quick actions">
      {quickActions.map((action) => (
        <button type="button" disabled={disabled} key={action.command} onClick={() => onPick(action.label)}>
          {action.label}
        </button>
      ))}
    </div>
  );
}

function StatePanel({
  state,
  labels,
  entityMaps
}: {
  state: SessionState | undefined;
  labels: ResolvedLabels;
  entityMaps: EntityMaps;
}) {
  return (
    <section className="case-card case-card--accent" aria-labelledby="current-location-heading">
      <p className="eyebrow">State</p>
      <h2 id="current-location-heading">{labels.location}</h2>
      <p className="location-name">{state ? labelEntity(entityMaps.locations, state.currentLocationId) : "Loading"}</p>
      <dl className="case-meta">
        <div>
          <dt>Turn</dt>
          <dd>{state?.turn ?? 0}</dd>
        </div>
        <div>
          <dt>{labels.facts}</dt>
          <dd>{state?.knownFacts.length ?? 0}</dd>
        </div>
      </dl>
    </section>
  );
}

function CollectionPanel({
  title,
  headingId,
  items,
  emptyText,
  labelFor
}: {
  title: string;
  headingId: string;
  items: string[];
  emptyText: string;
  labelFor: (id: string) => string;
}) {
  return (
    <section className="case-card" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {items.length > 0 ? (
        <ul className="chip-list">
          {items.map((item) => (
            <li key={item}>{labelFor(item)}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </section>
  );
}

function KeyValuePanel({ title, headingId, rows }: { title: string; headingId: string; rows: string[] }) {
  return (
    <section className="case-card" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {rows.length > 0 ? (
        <ul className="chip-list">
          {rows.map((row) => (
            <li key={row}>{row}</li>
          ))}
        </ul>
      ) : (
        <p className="empty-state">None.</p>
      )}
    </section>
  );
}

function ObjectivePanel({
  state,
  labels,
  entityMaps
}: {
  state: SessionState | undefined;
  labels: ResolvedLabels;
  entityMaps: EntityMaps;
}) {
  const rows = Object.entries(state?.objectiveStages ?? {}).map(([objectiveId, stage]) => {
    const objective = entityMaps.objectives.get(objectiveId);
    return `${objective?.name ?? formatId(objectiveId)}: ${stage}`;
  });

  return <KeyValuePanel title={labels.objectives} headingId="objectives-heading" rows={rows} />;
}

function TracePanel({ trace }: { trace: string }) {
  return (
    <section className="case-card trace-card" aria-labelledby="runtime-status-heading">
      <h2 id="runtime-status-heading">Runtime</h2>
      <p>{trace}</p>
    </section>
  );
}

function storyEntriesFromTurnResponse(
  body: TurnResponse,
  labels: ResolvedLabels,
  entityMaps: EntityMaps
): Array<Omit<StoryEntry, "id">> {
  const messages = body.messages?.length
    ? body.messages
    : [{ type: "narration" as const, text: body.outputText }];
  return messages.map((message) => ({
    tone: storyToneFromMessage(message),
    text: message.text,
    label: storyLabelFromMessage(message, labels, entityMaps)
  }));
}

function storyMarker(tone: StoryTone): string {
  switch (tone) {
    case "player":
      return "You";
    case "narrator":
      return "N";
    case "environment":
      return "E";
    case "character":
      return "C";
    case "system":
      return "!";
    case "pending":
      return "...";
    case "item":
      return "I";
    case "fact":
      return "F";
    case "scene":
      return "S";
  }
}

function storyToneFromMessage(message: TurnMessage): StoryTone {
  switch (message.type) {
    case "environment":
      return "environment";
    case "character":
      return "character";
    case "item":
      return "item";
    case "fact":
      return "fact";
    case "system":
      return "system";
    case "narration":
      return "narrator";
  }
}

function storyLabelFromMessage(message: TurnMessage, labels: ResolvedLabels, entityMaps: EntityMaps): string | undefined {
  switch (message.type) {
    case "character":
      return message.label ?? (message.characterId ? labelEntity(entityMaps.characters, message.characterId) : labels.characters);
    case "item":
      return message.label ?? labels.inventory;
    case "fact":
      return message.label ?? labels.facts;
    case "environment":
      return labels.location;
    case "system":
      return "System";
    case "narration":
      return "Narration";
  }
}

function formatTraceSummary(body: {
  acceptedPatches: unknown[];
  rejectedPatches: unknown[];
  trace: TracePayload;
}, entityMaps: EntityMaps): string {
  const precheck = body.trace.precheck?.ok === false
    ? `blocked:${localizeRuleReason(body.trace.precheck.reason ?? "unknown reason", entityMaps)}`
    : "ok";
  return [
    `handler=${labelAgentRole(body.trace.agentRole)}`,
    `model=${body.trace.modelName ?? "default"}`,
    `precheck=${precheck}`,
    `context=${formatContextIds(body.trace.contextIds, entityMaps)}`,
    `accepted=${body.acceptedPatches.length}`,
    `rejected=${body.rejectedPatches.length}`
  ].join("; ");
}

function resolveActionInput(value: string, quickActions: Profile["quickActions"]): { command: string; displayText: string } {
  const displayText = value.trim();
  const quickAction = quickActions.find((action) => action.label === displayText);
  return {
    command: quickAction?.command ?? displayText,
    displayText
  };
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function formatSubmitFailure(error: unknown): string {
  const detail = error instanceof Error ? error.message : "";
  return detail
    ? `Action failed: ${detail}. Input was kept for retry.`
    : "Action failed. Input was kept for retry.";
}

function labelAgentRole(role: string | undefined): string {
  switch (role) {
    case "character":
      return "Character";
    case "narrator":
      return "Narrator";
    case "none":
      return "None";
    default:
      return "Unknown";
  }
}

function formatContextIds(contextIds: string[] | undefined, entityMaps: EntityMaps): string {
  if (!contextIds?.length) return "none";
  return contextIds.map((contextId) => {
    const [kind, id] = contextId.split(":");
    if (kind === "location" && id) return `location:${labelEntity(entityMaps.locations, id)}`;
    if (kind === "character" && id) return `character:${labelEntity(entityMaps.characters, id)}`;
    return contextId;
  }).join(", ");
}

function localizeRuleReason(reason: string, entityMaps: EntityMaps): string {
  const unreachable = reason.match(/^Location is not reachable: (.+)$/);
  if (unreachable) return `location not reachable: ${labelEntity(entityMaps.locations, unreachable[1] ?? "")}`;

  const blockedEntry = reason.match(/^Location entry condition failed: (.+)$/);
  if (blockedEntry) return `location entry condition failed: ${labelEntity(entityMaps.locations, blockedEntry[1] ?? "")}`;

  const unknownLocation = reason.match(/^Unknown location: (.+)$/);
  if (unknownLocation) return `unknown location: ${labelEntity(entityMaps.locations, unknownLocation[1] ?? "")}`;

  const unknownCharacter = reason.match(/^Unknown character: (.+)$/);
  if (unknownCharacter) return `unknown character: ${labelEntity(entityMaps.characters, unknownCharacter[1] ?? "")}`;

  const lockedTopic = reason.match(/^Topic unlock condition failed: ([^.]+)\.(.+)$/);
  if (lockedTopic) return `topic locked for ${labelEntity(entityMaps.characters, lockedTopic[1] ?? "")}: ${formatId(lockedTopic[2] ?? "")}`;

  return reason;
}

function resolveLabels(labels: Record<string, string> | undefined): ResolvedLabels {
  return {
    location: labels?.location ?? "Location",
    characters: labels?.characters ?? "Characters",
    facts: labels?.facts ?? "Facts",
    inventory: labels?.inventory ?? "Inventory",
    resources: labels?.resources ?? "Resources",
    relationships: labels?.relationships ?? "Relationships",
    objectives: labels?.objectives ?? "Objectives"
  };
}

function buildEntityMaps(entities: SessionResponse["entities"] | undefined): EntityMaps {
  return {
    locations: new Map((entities?.locations ?? []).map((entity) => [entity.id, entity.name])),
    characters: new Map((entities?.characters ?? []).map((entity) => [entity.id, entity.name])),
    items: new Map((entities?.items ?? []).map((entity) => [entity.id, entity.name])),
    facts: new Map((entities?.facts ?? []).map((entity) => [entity.id, entity.name])),
    objectives: new Map((entities?.objectives ?? []).map((entity) => [entity.id, entity]))
  };
}

function labelEntity(map: Map<string, string>, id: string): string {
  return map.get(id) ?? formatId(id);
}

function formatRecordRows(record: Record<string, number> | undefined): string[] {
  return Object.entries(record ?? {}).map(([key, value]) => `${formatId(key)}=${value}`);
}

function formatRelationshipRows(record: Record<string, number> | undefined, entityMaps: EntityMaps): string[] {
  return Object.entries(record ?? {}).map(([key, value]) => `${labelEntity(entityMaps.characters, key)}=${value}`);
}

function formatObjectiveSummary(state: SessionState | undefined, entityMaps: EntityMaps): string {
  const [objectiveId, stage] = Object.entries(state?.objectiveStages ?? {})[0] ?? [];
  if (!objectiveId || !stage) return "Loading";
  const objective = entityMaps.objectives.get(objectiveId);
  return `${objective?.name ?? formatId(objectiveId)}: ${stage}`;
}

function formatId(id: string): string {
  return id.replace(/[_:-]+/g, " ");
}

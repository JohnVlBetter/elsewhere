"use client";

import { FormEvent, RefObject, useEffect, useMemo, useRef, useState } from "react";
import type { SessionState } from "@aigame/shared";
import { readTurnEventStream } from "./turnStream";

type StoryTone = "scene" | "player" | "narrator" | "environment" | "npc" | "system" | "pending" | "item" | "clue";

type StoryEntry = {
  id: number;
  tone: StoryTone;
  text: string;
  label?: string;
};

type TurnMessage = {
  type: "environment" | "narration" | "npc" | "system" | "item" | "clue";
  text: string;
  label?: string;
  npcId?: string;
  itemId?: string;
  clueId?: string;
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

type SessionResponse = {
  sessionId: string;
  state: SessionState;
  intro?: string;
};

const INITIAL_STORY: StoryEntry = {
  id: 1,
  tone: "scene",
  text: "暴雨敲打旧塔，所有人都被困在门厅。哈尔登爵士死了，管家、继承人和园丁都在等你开口。"
};

const QUICK_ACTIONS = [
  { label: "环顾门厅", command: "look" },
  { label: "检查银怀表", command: "inspect silver_watch" },
  { label: "询问管家", command: "ask butler alibi" },
  { label: "前往书房", command: "move study" }
];
const WAITING_TEXT = "已发送，等待回应...";
const TURN_TIMEOUT_MS = 45_000;

const LOCATION_LABELS: Record<string, string> = {
  foyer: "门厅",
  study: "书房",
  greenhouse: "温室"
};

const CLUE_LABELS: Record<string, string> = {
  broken_watch: "破损怀表",
  muddy_bootprint: "泥靴印",
  torn_letter: "撕裂信件",
  greenhouse_key: "温室钥匙",
  tower_bell_record: "钟楼记录",
  false_alibi: "虚假不在场证明"
};

const ITEM_LABELS: Record<string, string> = {
  greenhouse_key: "温室钥匙",
  silver_watch: "银怀表"
};

const NPC_LABELS: Record<string, string> = {
  butler: "管家",
  gardener: "园丁",
  heiress: "继承人"
};

const QUEST_STAGE_LABELS: Record<string, string> = {
  investigate: "调查中",
  accuse: "准备指认",
  resolved: "已结案"
};

export function GameShell() {
  const [turns, setTurns] = useState<StoryEntry[]>([INITIAL_STORY]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [state, setState] = useState<SessionState | undefined>();
  const [trace, setTrace] = useState("尚未提交行动。");
  const [sessionError, setSessionError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nextStoryId = useRef(INITIAL_STORY.id + 1);
  const storyLogRef = useRef<HTMLDivElement>(null);

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
        setSessionId(body.sessionId);
        setState(body.state);
        setTurns([{ ...INITIAL_STORY, text: body.intro ?? INITIAL_STORY.text }]);
        nextStoryId.current = INITIAL_STORY.id + 1;
        setSessionError(undefined);
      })
      .catch(() => {
        setSessionError("会话接口暂时不可用。");
        setTrace("会话接口不可用，无法载入案卷。");
      });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const actionInput = resolveActionInput(input);
    if (!actionInput.command || !sessionId || isSubmitting) return;

    setIsSubmitting(true);
    setInput("");
    setTrace("行动已送达，正在等待回应。");
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
        body: JSON.stringify({ sessionId, inputText: actionInput.command }),
        signal: controller.signal
      });

      const body = await readTurnEventStream<TurnResponse>(response, {
        onStatus: (message) => {
          setTrace(message);
          updateStoryEntry(pendingEntry.id, message);
        }
      });
      setState(body.state);
      setTrace(formatTraceSummary(body));
      replaceStoryEntry(pendingEntry.id, storyEntriesFromTurnResponse(body));
    } catch (error) {
      const isTimeout = isAbortError(error);
      const message = isTimeout
        ? "回应等待超时。刚才的行动没有生效，输入已保留，可稍后重试。"
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

  function storyEntriesFromTurnResponse(body: TurnResponse): Array<Omit<StoryEntry, "id">> {
    const messages = body.messages?.length
      ? body.messages
      : [{ type: "narration" as const, text: body.outputText }];
    return messages.map((message) => ({
      tone: storyToneFromMessage(message),
      text: message.text,
      label: storyLabelFromMessage(message)
    }));
  }

  useEffect(() => {
    const log = storyLogRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
  }, [turns]);

  const questStage = useMemo(() => {
    const stage = state?.questStages.solve_murder;
    return stage ? labelQuestStage(stage) : "载入中";
  }, [state]);

  return (
    <main className="game-shell">
      <section className="game-board" aria-label="案件主界面">
        <HeroPanel state={state} questStage={questStage} sessionError={sessionError} />
        <StoryLog turns={turns} storyLogRef={storyLogRef} />
        <ActionComposer
          input={input}
          isSubmitting={isSubmitting}
          isReady={Boolean(sessionId)}
          onInputChange={setInput}
          onQuickAction={setInput}
          onSubmit={submit}
        />
      </section>

      <aside className="case-sidebar" aria-label="案件侧栏">
        <CasePanel state={state} questStage={questStage} />
        <CollectionPanel
          title="已知线索"
          headingId="known-clues-heading"
          items={state?.knownClues ?? []}
          emptyText="还没有发现线索。"
          labelFor={labelClue}
        />
        <CollectionPanel
          title="随身物品"
          headingId="inventory-heading"
          items={state?.inventory ?? []}
          emptyText="目前没有携带物品。"
          labelFor={labelItem}
        />
        <TracePanel trace={trace} />
      </aside>
    </main>
  );
}

function HeroPanel({
  state,
  questStage,
  sessionError
}: {
  state: SessionState | undefined;
  questStage: string;
  sessionError: string | undefined;
}) {
  return (
    <header className="hero-panel">
      <div>
        <p className="eyebrow">AI 互动侦探游戏</p>
        <h1>雨塔谋杀案</h1>
        <p className="hero-copy">暴雨封锁旧塔。每一次行动都会推进案卷，也可能暴露新的矛盾。</p>
      </div>
      <dl className="hero-stats" aria-label="案件状态概览">
        <div>
          <dt>回合</dt>
          <dd>{state?.turn ?? 0}</dd>
        </div>
        <div>
          <dt>现场</dt>
          <dd>{state ? labelLocation(state.currentLocationId) : "载入中"}</dd>
        </div>
        <div>
          <dt>阶段</dt>
          <dd>{questStage}</dd>
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
        <p className="eyebrow">调查记录</p>
        <h2 id="story-heading">当前叙事</h2>
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
  onInputChange,
  onQuickAction,
  onSubmit
}: {
  input: string;
  isSubmitting: boolean;
  isReady: boolean;
  onInputChange: (value: string) => void;
  onQuickAction: (value: string) => void;
  onSubmit: (event: FormEvent) => void;
}) {
  const statusText = isSubmitting ? "已发送，等待回应" : isReady ? "等待你的下一步" : "正在连接案卷";

  return (
    <form onSubmit={onSubmit} className="action-composer">
      <div className="composer-label-row">
        <label htmlFor="action-input">行动指令</label>
        <span role="status" aria-live="polite">{statusText}</span>
      </div>
      <div className="action-row">
        <input
          id="action-input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="例如：检查银怀表"
          autoComplete="off"
          disabled={!isReady || isSubmitting}
        />
        <button type="submit" disabled={!input.trim() || !isReady || isSubmitting}>
          {isSubmitting ? "等待回应" : "发送"}
        </button>
      </div>
      <QuickActions disabled={!isReady || isSubmitting} onPick={onQuickAction} />
    </form>
  );
}

function QuickActions({ disabled, onPick }: { disabled: boolean; onPick: (value: string) => void }) {
  return (
    <div className="quick-actions" aria-label="快捷行动">
      {QUICK_ACTIONS.map((action) => (
        <button type="button" disabled={disabled} key={action.command} onClick={() => onPick(action.label)}>
          {action.label}
        </button>
      ))}
    </div>
  );
}

function CasePanel({ state, questStage }: { state: SessionState | undefined; questStage: string }) {
  return (
    <section className="case-card case-card--accent" aria-labelledby="current-location-heading">
      <p className="eyebrow">案件状态</p>
      <h2 id="current-location-heading">当前位置</h2>
      <p className="location-name">{state ? labelLocation(state.currentLocationId) : "载入中"}</p>
      <dl className="case-meta">
        <div>
          <dt>任务阶段</dt>
          <dd>{questStage}</dd>
        </div>
        <div>
          <dt>已知线索数</dt>
          <dd>{state?.knownClues.length ?? 0}</dd>
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

function TracePanel({ trace }: { trace: string }) {
  return (
    <section className="case-card trace-card" aria-labelledby="runtime-status-heading">
      <h2 id="runtime-status-heading">运行状态</h2>
      <p>{trace}</p>
    </section>
  );
}

function storyMarker(tone: StoryTone): string {
  switch (tone) {
    case "player":
      return "你";
    case "narrator":
      return "叙";
    case "environment":
      return "境";
    case "npc":
      return "角";
    case "system":
      return "!";
    case "pending":
      return "等";
    case "item":
      return "物";
    case "clue":
      return "线";
    case "scene":
      return "案";
  }
}

function storyToneFromMessage(message: TurnMessage): StoryTone {
  switch (message.type) {
    case "environment":
      return "environment";
    case "npc":
      return "npc";
    case "item":
      return "item";
    case "clue":
      return "clue";
    case "system":
      return "system";
    case "narration":
      return "narrator";
  }
}

function storyLabelFromMessage(message: TurnMessage): string | undefined {
  switch (message.type) {
    case "npc":
      return message.label ?? (message.npcId ? labelNpc(message.npcId) : "角色");
    case "item":
      return "道具";
    case "clue":
      return "线索";
    case "environment":
      return "环境";
    case "system":
      return "系统";
    case "narration":
      return "旁白";
  }
}

function formatTraceSummary(body: {
  acceptedPatches: unknown[];
  rejectedPatches: unknown[];
  trace: TracePayload;
}): string {
  const precheck = body.trace.precheck?.ok === false
    ? `未通过：${localizeRuleReason(body.trace.precheck.reason ?? "未知原因")}`
    : "通过";
  return [
    `处理=${labelAgentRole(body.trace.agentRole)}`,
    `模型=${body.trace.modelName ?? "默认模拟"}`,
    `校验=${precheck}`,
    `上下文=${formatContextIds(body.trace.contextIds)}`,
    `采纳=${body.acceptedPatches.length}`,
    `拒绝=${body.rejectedPatches.length}`
  ].join("；");
}

function resolveActionInput(value: string): { command: string; displayText: string } {
  const displayText = value.trim();
  const quickAction = QUICK_ACTIONS.find((action) => action.label === displayText);
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
    ? `行动提交失败：${detail} 输入已保留，可稍后重试。`
    : "行动提交失败。刚才的行动没有生效，输入已保留，可稍后重试。";
}

function labelAgentRole(role: string | undefined): string {
  switch (role) {
    case "npc":
      return "角色回应";
    case "narrator":
      return "旁白";
    case "none":
      return "未调用模型";
    default:
      return "未知";
  }
}

function formatContextIds(contextIds: string[] | undefined): string {
  if (!contextIds?.length) return "无";
  return contextIds.map((contextId) => {
    const [kind, id] = contextId.split(":");
    if (kind === "location" && id) return `位置:${labelLocation(id)}`;
    if (kind === "npc" && id) return `角色:${labelNpc(id)}`;
    return contextId;
  }).join("、");
}

function localizeRuleReason(reason: string): string {
  const unreachable = reason.match(/^Location is not reachable: (.+)$/);
  if (unreachable) return `当前位置无法前往 ${labelLocation(unreachable[1] ?? "")}。`;

  const unknownNpc = reason.match(/^Unknown NPC: (.+)$/);
  if (unknownNpc) return `没有找到角色 ${labelNpc(unknownNpc[1] ?? "")}。`;

  return reason;
}

function labelLocation(id: string): string {
  return LOCATION_LABELS[id] ?? formatId(id);
}

function labelClue(id: string): string {
  return CLUE_LABELS[id] ?? formatId(id);
}

function labelItem(id: string): string {
  return ITEM_LABELS[id] ?? labelClue(id);
}

function labelNpc(id: string): string {
  return NPC_LABELS[id] ?? formatId(id);
}

function labelQuestStage(stage: string): string {
  return QUEST_STAGE_LABELS[stage] ?? formatId(stage);
}

function formatId(id: string): string {
  return id.replace(/[_:-]+/g, " ");
}

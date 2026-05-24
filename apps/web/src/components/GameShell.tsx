"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { SessionState } from "@aigame/shared";

type StoryTone = "scene" | "player" | "narrator" | "system";

type StoryEntry = {
  id: number;
  tone: StoryTone;
  text: string;
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
  state: SessionState;
  acceptedPatches: unknown[];
  rejectedPatches: unknown[];
  trace: TracePayload;
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

  useEffect(() => {
    void fetch("/api/session", { method: "POST" })
      .then((response) => {
        if (!response.ok) throw new Error("Session API failed");
        return response.json();
      })
      .then((body: { sessionId: string; state: SessionState }) => {
        setSessionId(body.sessionId);
        setState(body.state);
        setSessionError(undefined);
      })
      .catch(() => {
        setSessionError("会话接口暂时不可用。");
        setTrace("会话接口不可用，无法载入案卷。");
      });
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const command = input.trim();
    if (!command || !sessionId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, inputText: command })
      });
      if (!response.ok) throw new Error("Turn API failed");

      const body = await response.json() as TurnResponse;
      setState(body.state);
      setTrace(formatTraceSummary(body));
      setTurns((current) => [
        ...current,
        { id: current.length + 1, tone: "player", text: command },
        { id: current.length + 2, tone: "narrator", text: body.outputText }
      ]);
      setInput("");
    } catch {
      setTrace("行动提交失败，请检查服务状态后重试。");
      setTurns((current) => [
        ...current,
        { id: current.length + 1, tone: "system", text: "行动没有送达。命令已保留，可以稍后重试。" }
      ]);
    } finally {
      setIsSubmitting(false);
    }
  }

  const questStage = useMemo(() => {
    const stage = state?.questStages.solve_murder;
    return stage ? labelQuestStage(stage) : "载入中";
  }, [state]);

  return (
    <main className="game-shell">
      <section className="game-board" aria-label="案件主界面">
        <HeroPanel state={state} questStage={questStage} sessionError={sessionError} />
        <StoryLog turns={turns} />
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

function StoryLog({ turns }: { turns: StoryEntry[] }) {
  return (
    <section className="story-panel" aria-labelledby="story-heading">
      <div className="panel-heading">
        <p className="eyebrow">调查记录</p>
        <h2 id="story-heading">当前叙事</h2>
      </div>
      <div className="story-log">
        {turns.map((turn) => (
          <article className={`story-entry story-entry--${turn.tone}`} key={turn.id}>
            <span className="story-marker">{storyMarker(turn.tone)}</span>
            <p>{turn.text}</p>
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
  return (
    <form onSubmit={onSubmit} className="action-composer">
      <div className="composer-label-row">
        <label htmlFor="action-input">行动指令</label>
        <span>{isReady ? "等待你的下一步" : "正在连接案卷"}</span>
      </div>
      <div className="action-row">
        <input
          id="action-input"
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          placeholder="例如：inspect silver_watch"
          autoComplete="off"
        />
        <button type="submit" disabled={!input.trim() || !isReady || isSubmitting}>
          {isSubmitting ? "发送中" : "发送"}
        </button>
      </div>
      <QuickActions onPick={onQuickAction} />
    </form>
  );
}

function QuickActions({ onPick }: { onPick: (value: string) => void }) {
  return (
    <div className="quick-actions" aria-label="快捷行动">
      {QUICK_ACTIONS.map((action) => (
        <button type="button" key={action.command} onClick={() => onPick(action.command)}>
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
    <section className="case-card trace-card" aria-labelledby="developer-trace-heading">
      <h2 id="developer-trace-heading">开发追踪</h2>
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
    case "system":
      return "!";
    case "scene":
      return "案";
  }
}

function formatTraceSummary(body: {
  acceptedPatches: unknown[];
  rejectedPatches: unknown[];
  trace: TracePayload;
}): string {
  const raw = body.trace.agentRawOutput?.narration ?? body.trace.agentRawOutput?.privateNotes ?? "无";
  const precheck = body.trace.precheck?.ok === false ? `阻止:${body.trace.precheck.reason ?? "未知原因"}` : "通过";
  return [
    `角色=${body.trace.agentRole ?? "unknown"}`,
    `模型=${body.trace.modelName ?? "unknown"}`,
    `预检=${precheck}`,
    `上下文=${body.trace.contextIds?.join(",") ?? "无"}`,
    `accepted=${body.acceptedPatches.length}`,
    `rejected=${body.rejectedPatches.length}`,
    `原始输出=${raw}`
  ].join("；");
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

function labelQuestStage(stage: string): string {
  return QUEST_STAGE_LABELS[stage] ?? formatId(stage);
}

function formatId(id: string): string {
  return id.replace(/[_:-]+/g, " ");
}

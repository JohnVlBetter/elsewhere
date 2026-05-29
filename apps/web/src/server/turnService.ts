import { runTurn } from "@aigame/runtime";
import { createRuntimeModelConfig } from "./modelProvider";
import { loadPackById } from "./packRegistry";
import { sessionStore } from "./sessionStore";

export interface TurnRequestBody {
  sessionId: string;
  inputText: string;
}

const sessionTurnLocks = new Map<string, Promise<void>>();

export class TurnRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "TurnRequestError";
  }
}

export function parseTurnRequestBody(value: unknown): TurnRequestBody {
  if (!isRecord(value) || typeof value.sessionId !== "string" || typeof value.inputText !== "string") {
    throw new TurnRequestError("Invalid turn request", 400);
  }
  const sessionId = value.sessionId.trim();
  const inputText = value.inputText.trim();
  if (!sessionId || !inputText) {
    throw new TurnRequestError("Invalid turn request", 400);
  }

  return {
    sessionId,
    inputText
  };
}

export async function runStoredTurn(
  body: TurnRequestBody,
  onStatus?: (message: string) => void,
  signal?: AbortSignal
) {
  return withSessionTurnLock(body.sessionId, () => runStoredTurnUnlocked(body, onStatus, signal));
}

async function runStoredTurnUnlocked(
  body: TurnRequestBody,
  onStatus?: (message: string) => void,
  signal?: AbortSignal
) {
  throwIfAborted(signal);
  const session = await sessionStore.getSession(body.sessionId);
  if (!session) {
    throw new TurnRequestError("Session not found", 404);
  }
  const pack = loadPackById(session.packId);

  const runtimeModel = createRuntimeModelConfig();
  onStatus?.("文字正在延展");
  const result = await runTurn({
    pack,
    state: session.state,
    inputText: body.inputText,
    model: runtimeModel.model,
    modelName: runtimeModel.modelName,
    signal
  });
  throwIfAborted(signal);

  onStatus?.("故事已记录");
  await sessionStore.updateSessionState(body.sessionId, result.state);
  await sessionStore.appendTimelineEvents(body.sessionId, result.timelineEvents);

  return result;
}

export function formatTurnFailure(error: unknown): { status: number; error: string } {
  if (error instanceof TurnRequestError) {
    return { status: error.status, error: "行动没有成功提交，请重试。" };
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Model response content was not valid JSON")) {
    return {
      status: 502,
      error: "刚才的回应没有整理成可继续的故事，行动没有生效；请重试。"
    };
  }

  if (message.includes("Model request failed")) {
    return {
      status: 502,
      error: "故事暂时没有继续，刚才的行动没有生效；请稍后重试。"
    };
  }

  if (message.includes("No runtime model provider configured")) {
    return {
      status: 503,
      error: "故事还没有准备好，暂时不能继续。"
    };
  }

  return {
    status: 500,
    error: "行动处理失败，刚才的行动没有生效；请重试。"
  };
}

async function withSessionTurnLock<T>(sessionId: string, operation: () => Promise<T>): Promise<T> {
  const previous = sessionTurnLocks.get(sessionId) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });
  const tail = previous.catch(() => undefined).then(() => current);
  sessionTurnLocks.set(sessionId, tail);

  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    releaseCurrent();
    if (sessionTurnLocks.get(sessionId) === tail) {
      sessionTurnLocks.delete(sessionId);
    }
  }
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new TurnRequestError("Turn request was cancelled", 499);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

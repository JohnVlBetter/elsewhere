import { loadWorldPack } from "@aigame/pack";
import { runTurn } from "@aigame/runtime";
import { ActionSchema } from "@aigame/shared";
import { createRuntimeModelConfig } from "./modelProvider";
import { sessionStore } from "./sessionStore";

export interface TurnRequestBody {
  sessionId: string;
  inputText: string;
}

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

  return {
    sessionId: value.sessionId,
    inputText: value.inputText
  };
}

export async function runStoredTurn(
  body: TurnRequestBody,
  onStatus?: (message: string) => void
) {
  const pack = loadWorldPack("packs/rain-tower");
  const session = sessionStore.getSession(body.sessionId);
  if (!session) {
    throw new TurnRequestError("Session not found", 404);
  }

  const runtimeModel = createRuntimeModelConfig();
  onStatus?.("正在调用模型...");
  const result = await runTurn({
    pack,
    state: session.state,
    inputText: body.inputText,
    model: runtimeModel.model,
    modelName: runtimeModel.modelName
  });

  onStatus?.("正在写入案卷...");
  sessionStore.updateSessionState(body.sessionId, result.state);
  sessionStore.appendEvent({
    sessionId: body.sessionId,
    turnNo: result.state.turn,
    actor: "player",
    inputText: body.inputText,
    action: ActionSchema.parse(result.trace.action),
    outputText: result.outputText,
    patches: result.acceptedPatches,
    trace: result.trace
  });

  return result;
}

export function formatTurnFailure(error: unknown): { status: number; error: string } {
  if (error instanceof TurnRequestError) {
    return { status: error.status, error: error.message };
  }

  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Model response content was not valid JSON")) {
    return {
      status: 502,
      error: "模型返回内容不完整，刚才的行动没有生效；请重试。"
    };
  }

  if (message.includes("Model request failed")) {
    return {
      status: 502,
      error: "模型服务暂时不可用，刚才的行动没有生效；请稍后重试。"
    };
  }

  return {
    status: 500,
    error: "行动处理失败，刚才的行动没有生效；请重试。"
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

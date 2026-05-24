import { NextRequest, NextResponse } from "next/server";
import { loadWorldPack } from "@aigame/pack";
import { runTurn } from "@aigame/runtime";
import { ActionSchema } from "@aigame/shared";
import { createRuntimeModelConfig } from "../../../src/server/modelProvider";
import { sessionStore } from "../../../src/server/sessionStore";

export async function POST(request: NextRequest) {
  const body = await request.json() as { sessionId: string; inputText: string };
  const pack = loadWorldPack("packs/rain-tower");
  const session = sessionStore.getSession(body.sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  const runtimeModel = createRuntimeModelConfig();
  const result = await runTurn({
    pack,
    state: session.state,
    inputText: body.inputText,
    model: runtimeModel.model,
    modelName: runtimeModel.modelName
  });
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

  return NextResponse.json(result);
}

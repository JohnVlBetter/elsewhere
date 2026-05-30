import { NextRequest, NextResponse } from "next/server";
import { toPlayerTurnResult } from "../../../../src/server/playerTurnResult";
import { formatTurnFailure, parseTurnRequestBody, runStoredTurnStream, TurnRequestError } from "../../../../src/server/turnService";

export async function POST(request: NextRequest) {
  let body: ReturnType<typeof parseTurnRequestBody>;
  try {
    body = parseTurnRequestBody(await readJsonBody(request));
  } catch (error) {
    const failure = formatTurnFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        send("turn:start", { inputText: body.inputText });
        const result = await runStoredTurnStream(
          body,
          (event) => {
            if (event.type === "action:start") {
              send("action:start", { actionIndex: event.actionIndex, inputText: event.inputText });
            } else {
              send("action:result", {
                actionIndex: event.actionIndex,
                inputText: event.inputText,
                result: toPlayerTurnResult(event.result)
              });
            }
          },
          (message) => send("status", { message }),
          request.signal
        );
        send("turn:done", {
          state: result.state,
          stoppedAt: result.stoppedAt,
          actionCount: result.actionResults.length
        });
        const lastResult = result.actionResults.at(-1);
        if (lastResult) {
          send("result", toPlayerTurnResult(lastResult));
        }
      } catch (error) {
        const failure = formatTurnFailure(error);
        send("error", { message: failure.error });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive"
    }
  });
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new TurnRequestError("Invalid turn request", 400);
  }
}

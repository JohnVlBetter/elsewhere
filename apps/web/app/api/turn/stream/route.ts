import { NextRequest, NextResponse } from "next/server";
import { formatTurnFailure, parseTurnRequestBody, runStoredTurn, TurnRequestError } from "../../../../src/server/turnService";

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
        send("status", { message: "文字正在延展" });
        const result = await runStoredTurn(body, (message) => send("status", { message }), request.signal);
        send("result", result);
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

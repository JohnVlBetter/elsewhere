import { NextRequest, NextResponse } from "next/server";
import { formatTurnFailure, parseTurnRequestBody, runStoredTurn } from "../../../../src/server/turnService";

export async function POST(request: NextRequest) {
  let body: ReturnType<typeof parseTurnRequestBody>;
  try {
    body = parseTurnRequestBody(await request.json());
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
        send("status", { message: "行动已接收，正在整理上下文..." });
        const result = await runStoredTurn(body, (message) => send("status", { message }));
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

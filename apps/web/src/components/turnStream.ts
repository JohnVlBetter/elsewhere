export async function readTurnEventStream<T>(
  response: Response,
  options: {
    onStatus?: (message: string) => void;
    onActionStart?: (event: { actionIndex: number; inputText: string }) => void;
    onActionResult?: (event: { actionIndex: number; inputText: string; result: T }) => void;
    onActionError?: (event: { actionIndex?: number; inputText?: string; message: string }) => void;
  }
): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  if (!response.body) {
    throw new Error("故事暂时没有回应，请重试。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (value) {
      buffer += decoder.decode(value, { stream: !done });
    }

    let eventEnd = findEventEnd(buffer);
    while (eventEnd >= 0) {
      const rawEvent = buffer.slice(0, eventEnd);
      buffer = buffer.slice(eventEnd + eventSeparatorLength(buffer, eventEnd));
      const event = parseServerSentEvent(rawEvent);

      if (event.name === "status") {
        options.onStatus?.(readStatusMessage(event.data));
      } else if (event.name === "action:start") {
        options.onActionStart?.(JSON.parse(event.data) as { actionIndex: number; inputText: string });
      } else if (event.name === "action:result") {
        const body = JSON.parse(event.data) as { actionIndex: number; inputText: string; result: T };
        options.onActionResult?.(body);
      } else if (event.name === "action:error") {
        const body = JSON.parse(event.data) as { actionIndex?: number; inputText?: string; message?: string };
        const message = playerSafeError(body.message ?? "行动处理失败。");
        options.onActionError?.({ ...body, message });
        throw new Error(message);
      } else if (event.name === "turn:done") {
        return JSON.parse(event.data) as T;
      } else if (event.name === "result") {
        return JSON.parse(event.data) as T;
      } else if (event.name === "error") {
        throw new Error(playerSafeError(readEventMessage(event.data)));
      }

      eventEnd = findEventEnd(buffer);
    }

    if (done) break;
  }

  throw new Error("故事回应中断，请重试。");
}

async function readErrorResponse(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string" && body.error) return playerSafeError(body.error);
  } catch {
    // Fall through to a stable generic message.
  }

  return playerSafeError("行动没有成功提交，请重试。");
}

function parseServerSentEvent(rawEvent: string): { name: string; data: string } {
  const lines = rawEvent.replace(/\r\n/g, "\n").split("\n");
  let name = "message";
  const data: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(":")) continue;
    if (line.startsWith("event:")) {
      name = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      data.push(line.slice("data:".length).trimStart());
    }
  }

  return { name, data: data.join("\n") };
}

function readStatusMessage(data: string): string {
  return playerSafeStatus(readEventMessage(data));
}

function readEventMessage(data: string): string {
  try {
    const body = JSON.parse(data) as { message?: unknown };
    if (typeof body.message === "string" && body.message) return body.message;
  } catch {
    // Some event emitters send plain-text data; sanitize it at the call site.
  }

  return data || "行动处理失败。";
}

function playerSafeStatus(message: string): string {
  const statusLabels: Record<string, string> = {
    pending: "文字正在延展",
    running: "文字正在延展",
    complete: "故事已记录",
    "行动已接收": "行动已接收",
    "文字正在延展": "文字正在延展",
    "故事已记录": "故事已记录",
    "正在调用模型...": "文字正在延展",
    "正在写入案卷...": "故事已记录",
    "行动已记录，正在思考...": "文字正在延展",
    "行动已记录，正在思索...": "文字正在延展"
  };

  return statusLabels[message] ?? "文字正在延展";
}

function playerSafeError(message: string): string {
  if (message.includes("模型")) {
    return "刚才的回应没有整理成可继续的故事，请重试。";
  }

  const unsafeTerms = [
    "DEEPSEEK",
    "AIGAME_MODEL_PROVIDER",
    "Invalid turn request",
    "provider",
    "Runtime",
    "Session not found",
    "Turn request",
    "cancelled",
    "Turn stream",
    "stream",
    "request failed"
  ];

  const normalized = message.toLowerCase();
  return unsafeTerms.some((term) => normalized.includes(term.toLowerCase()))
    ? "行动没有成功提交，请重试。"
    : message;
}

function findEventEnd(buffer: string): number {
  const lf = buffer.indexOf("\n\n");
  const crlf = buffer.indexOf("\r\n\r\n");
  if (lf < 0) return crlf;
  if (crlf < 0) return lf;
  return Math.min(lf, crlf);
}

function eventSeparatorLength(buffer: string, eventEnd: number): number {
  return buffer.startsWith("\r\n\r\n", eventEnd) ? 4 : 2;
}

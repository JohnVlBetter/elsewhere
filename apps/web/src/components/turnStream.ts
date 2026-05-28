export async function readTurnEventStream<T>(
  response: Response,
  options: { onStatus?: (message: string) => void }
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
        options.onStatus?.(readMessage(event.data));
      } else if (event.name === "result") {
        return JSON.parse(event.data) as T;
      } else if (event.name === "error") {
        throw new Error(playerSafeError(readMessage(event.data)));
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

function readMessage(data: string): string {
  try {
    const body = JSON.parse(data) as { message?: unknown };
    if (typeof body.message === "string" && body.message) return playerSafeStatus(body.message);
  } catch {
    // Some event emitters send plain-text data; surface it as-is.
  }

  return data || "行动处理失败。";
}

function playerSafeStatus(message: string): string {
  const statusLabels: Record<string, string> = {
    pending: "文字正在延展",
    running: "文字正在延展",
    complete: "故事已记录",
    "正在调用模型...": "文字正在延展",
    "正在写入案卷...": "故事已记录",
    "行动已记录，正在思考...": "文字正在延展",
    "行动已记录，正在思索...": "文字正在延展"
  };

  return statusLabels[message] ?? message;
}

function playerSafeError(message: string): string {
  if (message.includes("模型")) {
    return "刚才的回应没有整理成可继续的故事，请重试。";
  }

  const unsafeTerms = [
    "DEEPSEEK",
    "AIGAME_MODEL_PROVIDER",
    "provider",
    "Runtime",
    "Session not found",
    "Turn stream",
    "stream",
    "request failed"
  ];

  return unsafeTerms.some((term) => message.includes(term))
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

export async function readTurnEventStream<T>(
  response: Response,
  options: { onStatus?: (message: string) => void }
): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorResponse(response));
  }

  if (!response.body) {
    throw new Error("Turn stream did not include a response body.");
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
        throw new Error(readMessage(event.data));
      }

      eventEnd = findEventEnd(buffer);
    }

    if (done) break;
  }

  throw new Error("Turn stream ended before a result.");
}

async function readErrorResponse(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: unknown };
    if (typeof body.error === "string" && body.error) return body.error;
  } catch {
    // Fall through to a stable generic message.
  }

  return `Turn stream request failed: ${response.status}`;
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
    pending: "思索中...",
    running: "思索中...",
    complete: "已记录...",
    "正在调用模型...": "思索中...",
    "正在写入案卷...": "已记录..."
  };

  return statusLabels[message] ?? message;
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

import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SessionStateSchema, TimelineEventSchema } from "@aigame/shared";
import type { SessionState, TimelineEvent } from "@aigame/shared";

export type JsonlCreateSessionInput = {
  packId: string;
  state?: SessionState;
  initialState?: SessionState;
};

export type JsonlStoredSession = {
  id: string;
  packId: string;
  state: SessionState;
  createdAt: string;
  updatedAt: string;
};

export function createJsonlSessionStore(root = ".tmp/sessions") {
  const sessionDir = (sessionId: string) => join(root, sessionId);
  const statePath = (sessionId: string) => join(sessionDir(sessionId), "state.json");
  const timelinePath = (sessionId: string) => join(sessionDir(sessionId), "timeline.jsonl");

  async function writeState(session: JsonlStoredSession) {
    await mkdir(sessionDir(session.id), { recursive: true });
    const tempPath = `${statePath(session.id)}.tmp`;
    await writeFile(tempPath, JSON.stringify(session, null, 2), "utf8");
    await rename(tempPath, statePath(session.id));
  }

  return {
    async createSession(input: JsonlCreateSessionInput): Promise<JsonlStoredSession> {
      const now = new Date().toISOString();
      const rawState = input.state ?? input.initialState;
      if (!rawState) {
        throw new Error("Missing session state");
      }
      const session = {
        id: randomUUID(),
        packId: input.packId,
        state: SessionStateSchema.parse({ ...rawState, packId: input.packId }),
        createdAt: now,
        updatedAt: now
      };
      await writeState(session);
      await writeFile(timelinePath(session.id), "", "utf8");
      return session;
    },

    async getSession(sessionId: string): Promise<JsonlStoredSession | undefined> {
      try {
        const raw = await readFile(statePath(sessionId), "utf8");
        const parsed = JSON.parse(raw) as JsonlStoredSession;
        return {
          ...parsed,
          state: SessionStateSchema.parse(parsed.state)
        };
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return undefined;
        throw error;
      }
    },

    async updateSessionState(sessionId: string, state: SessionState): Promise<JsonlStoredSession> {
      const existing = await this.getSession(sessionId);
      if (!existing) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      const session = {
        ...existing,
        state: SessionStateSchema.parse({ ...state, packId: existing.packId }),
        updatedAt: new Date().toISOString()
      };
      await writeState(session);
      return session;
    },

    async appendTimelineEvents(sessionId: string, events: TimelineEvent[]): Promise<void> {
      await mkdir(sessionDir(sessionId), { recursive: true });
      const lines = events
        .map((event) => JSON.stringify(TimelineEventSchema.parse(event)))
        .join("\n");
      if (lines.length > 0) {
        await appendFile(timelinePath(sessionId), `${lines}\n`, "utf8");
      }
    },

    async listTimelineEvents(sessionId: string): Promise<TimelineEvent[]> {
      try {
        const raw = await readFile(timelinePath(sessionId), "utf8");
        return raw
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => TimelineEventSchema.parse(JSON.parse(line)));
      } catch (error) {
        if (isNodeError(error) && error.code === "ENOENT") return [];
        throw error;
      }
    }
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

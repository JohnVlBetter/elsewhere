import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { SessionStateSchema } from "@aigame/shared";
import type { GameAction, GamePatch, SessionState } from "@aigame/shared";

export interface StoredSession {
  id: string;
  packId: string;
  state: SessionState;
}

export interface StoredEvent {
  id: string;
  sessionId: string;
  turnNo: number;
  actor: string;
  inputText: string;
  action: GameAction;
  outputText: string;
  patches: GamePatch[];
  trace: Record<string, unknown>;
}

export function createSqliteStore(path: string) {
  const db = new Database(path);
  db.exec(`
    create table if not exists sessions (
      id text primary key,
      pack_id text not null,
      state_json text not null,
      created_at text not null
    );
    create table if not exists events (
      id text primary key,
      session_id text not null,
      turn_no integer not null,
      actor text not null,
      input_text text not null,
      action_json text not null,
      output_text text not null,
      patches_json text not null,
      trace_json text not null,
      created_at text not null
    );
  `);

  return {
    createSession(input: { packId: string; initialState: SessionState }): StoredSession {
      const id = randomUUID();
      db.prepare("insert into sessions (id, pack_id, state_json, created_at) values (?, ?, ?, ?)")
        .run(id, input.packId, JSON.stringify(input.initialState), new Date().toISOString());
      return { id, packId: input.packId, state: input.initialState };
    },
    updateSessionState(sessionId: string, state: SessionState): void {
      db.prepare("update sessions set state_json = ? where id = ?").run(JSON.stringify(state), sessionId);
    },
    getSession(sessionId: string): StoredSession | undefined {
      const row = db.prepare("select id, pack_id as packId, state_json as stateJson from sessions where id = ?").get(sessionId) as
        | { id: string; packId: string; stateJson: string }
        | undefined;
      if (!row) return undefined;
      return { id: row.id, packId: row.packId, state: SessionStateSchema.parse(JSON.parse(row.stateJson)) };
    },
    appendEvent(input: Omit<StoredEvent, "id">): StoredEvent {
      const id = randomUUID();
      db.prepare(`
        insert into events (id, session_id, turn_no, actor, input_text, action_json, output_text, patches_json, trace_json, created_at)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        input.sessionId,
        input.turnNo,
        input.actor,
        input.inputText,
        JSON.stringify(input.action),
        input.outputText,
        JSON.stringify(input.patches),
        JSON.stringify(input.trace),
        new Date().toISOString()
      );
      return { id, ...input };
    },
    listEvents(sessionId: string): StoredEvent[] {
      const rows = db.prepare("select * from events where session_id = ? order by turn_no asc").all(sessionId) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        sessionId: String(row.session_id),
        turnNo: Number(row.turn_no),
        actor: String(row.actor),
        inputText: String(row.input_text),
        action: JSON.parse(String(row.action_json)),
        outputText: String(row.output_text),
        patches: JSON.parse(String(row.patches_json)),
        trace: JSON.parse(String(row.trace_json))
      }));
    }
  };
}

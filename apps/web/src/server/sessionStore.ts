import { createSqliteStore } from "@aigame/persistence";

type EnvLike = Record<string, string | undefined>;

export function resolveWebDbPath(env: EnvLike = process.env): string {
  return env.AIGAME_DB_PATH ?? ".tmp/aigame.db";
}

export const sessionStore = createSqliteStore(resolveWebDbPath());

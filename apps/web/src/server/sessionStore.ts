import { createJsonlSessionStore } from "@aigame/persistence";

type EnvLike = Record<string, string | undefined>;

export function resolveWebSessionRoot(env: EnvLike = process.env): string {
  return env.AIGAME_SESSION_ROOT ?? ".tmp/sessions";
}

export const sessionStore = createJsonlSessionStore(resolveWebSessionRoot());

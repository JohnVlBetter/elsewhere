import { createSqliteStore } from "@aigame/persistence";

export const sessionStore = createSqliteStore(process.env.AIGAME_DB_PATH ?? "aigame.db");

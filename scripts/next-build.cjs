const path = require("node:path");
const { stripGeneratedRoutesImport } = require("./next-env-routes.cjs");

process.env.AIGAME_DB_PATH ??= ":memory:";
process.on("exit", () => {
  stripGeneratedRoutesImport(path.resolve("apps/web/next-env.d.ts"));
});

process.argv = [
  process.argv[0],
  require.resolve("next/dist/bin/next"),
  "build",
  "apps/web",
  "--webpack"
];

require("next/dist/bin/next");

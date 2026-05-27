const fs = require("node:fs");

const PRODUCTION_ROUTES_IMPORT = 'import "./.next/types/routes.d.ts";';
const DEV_ROUTES_IMPORT = 'import "./.next/dev/types/routes.d.ts";';
const GENERATED_ROUTES_IMPORTS = new Set([PRODUCTION_ROUTES_IMPORT, DEV_ROUTES_IMPORT]);

function stripGeneratedRoutesImport(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const original = fs.readFileSync(filePath, "utf8");
  const stripped = original
    .split(/\r?\n/)
    .filter((line) => !GENERATED_ROUTES_IMPORTS.has(line.trim()))
    .join("\r\n")
    .replace(/(?:\r\n)*$/, "\r\n");

  if (stripped !== original) {
    fs.writeFileSync(filePath, stripped, "utf8");
  }
}

if (require.main === module) {
  stripGeneratedRoutesImport(process.argv[2] ?? "apps/web/next-env.d.ts");
}

module.exports = {
  stripGeneratedRoutesImport
};

const fs = require("node:fs");

const PRODUCTION_ROUTES_IMPORT = 'import "./.next/types/routes.d.ts";';
const DEV_ROUTES_IMPORT = 'import "./.next/dev/types/routes.d.ts";';

function restoreDevRoutesImport(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const original = fs.readFileSync(filePath, "utf8");
  const restored = original.replace(PRODUCTION_ROUTES_IMPORT, DEV_ROUTES_IMPORT).replace(/\r?\n/g, "\r\n");

  if (restored !== original) {
    fs.writeFileSync(filePath, restored, "utf8");
  }
}

module.exports = {
  restoreDevRoutesImport
};

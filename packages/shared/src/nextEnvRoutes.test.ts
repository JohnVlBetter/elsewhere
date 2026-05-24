import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const routes = require("../../../scripts/next-env-routes.cjs") as {
  restoreDevRoutesImport(filePath: string): void;
};

describe("Next route type import helper", () => {
  it("restores the dev route types import after a production build", () => {
    const filePath = join(mkdtempSync(join(tmpdir(), "next-env-")), "next-env.d.ts");
    writeFileSync(filePath, '/// <reference types="next" />\nimport "./.next/types/routes.d.ts";\n');

    routes.restoreDevRoutesImport(filePath);

    expect(readFileSync(filePath, "utf8")).toBe(
      '/// <reference types="next" />\r\nimport "./.next/dev/types/routes.d.ts";\r\n'
    );
  });
});

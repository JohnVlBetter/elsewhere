import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const routes = require("../../../scripts/next-env-routes.cjs") as {
  stripGeneratedRoutesImport(filePath: string): void;
};

describe("Next route type import helper", () => {
  it("removes generated route type imports after a production build", () => {
    const filePath = join(mkdtempSync(join(tmpdir(), "next-env-")), "next-env.d.ts");
    writeFileSync(filePath, '/// <reference types="next" />\nimport "./.next/types/routes.d.ts";\nimport "./.next/dev/types/routes.d.ts";\n');

    routes.stripGeneratedRoutesImport(filePath);

    expect(readFileSync(filePath, "utf8")).toBe(
      '/// <reference types="next" />\r\n'
    );
  });
});

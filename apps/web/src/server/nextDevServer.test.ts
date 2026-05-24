import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

describe("Next dev server launcher", () => {
  it("sets Next's internal dev-server marker before starting", () => {
    const script = readFileSync("scripts/next-dev-in-process.cjs", "utf8");
    const calls: unknown[] = [];
    const fakeProcess = {
      env: {} as Record<string, string>,
      argv: ["node", "scripts/next-dev-in-process.cjs", "--port", "3333"],
      exitCode: undefined as number | undefined
    };

    vm.runInNewContext(script, {
      console,
      process: fakeProcess,
      require: (specifier: string) => {
        if (specifier === "node:path") return path;
        if (specifier === "next/dist/server/lib/start-server") {
          return {
            startServer: (options: unknown) => {
              calls.push({
                options,
                envAtStart: { ...fakeProcess.env }
              });
              return Promise.resolve();
            }
          };
        }
        throw new Error(`Unexpected require: ${specifier}`);
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      options: { isDev: true, port: 3333 },
      envAtStart: { __NEXT_DEV_SERVER: "true" }
    });
  });
});

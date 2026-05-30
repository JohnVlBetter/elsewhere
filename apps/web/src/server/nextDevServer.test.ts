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
        if (specifier === "node:fs") return { existsSync: () => false };
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
      envAtStart: { AIGAME_MODEL_PROVIDER: "fake", __NEXT_DEV_SERVER: "true" }
    });
  });

  it("does not replace an explicitly configured runtime model provider", () => {
    const script = readFileSync("scripts/next-dev-in-process.cjs", "utf8");
    const calls: unknown[] = [];
    const fakeProcess = {
      env: { AIGAME_MODEL_PROVIDER: "openai-compatible" } as Record<string, string>,
      argv: ["node", "scripts/next-dev-in-process.cjs"],
      exitCode: undefined as number | undefined
    };

    vm.runInNewContext(script, {
      console,
      process: fakeProcess,
      require: (specifier: string) => {
        if (specifier === "node:fs") return { existsSync: () => false };
        if (specifier === "node:path") return path;
        if (specifier === "next/dist/server/lib/start-server") {
          return {
            startServer: () => {
              calls.push({ envAtStart: { ...fakeProcess.env } });
              return Promise.resolve();
            }
          };
        }
        throw new Error(`Unexpected require: ${specifier}`);
      }
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      envAtStart: { AIGAME_MODEL_PROVIDER: "openai-compatible", __NEXT_DEV_SERVER: "true" }
    });
  });

  it("exposes a reusable restart script for the web dev server", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["web:stop"]).toBe("node scripts/stop-web.cjs");
    expect(packageJson.scripts["web:restart"]).toBe("npm run web:stop && npm run web:dev");

    const launcher = readFileSync("scripts/next-dev-in-process.cjs", "utf8");
    expect(launcher).toContain("function loadDotEnv");
    expect(launcher).toContain('loadDotEnv(path.resolve(".env.local"))');

    const stopScript = readFileSync("scripts/stop-web.cjs", "utf8");
    expect(stopScript).toContain("web-dev.pid");
    expect(stopScript).toContain("taskkill.exe");
  });
});

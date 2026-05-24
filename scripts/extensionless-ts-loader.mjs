import { existsSync, statSync } from "node:fs";
import { dirname, resolve as resolvePath } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function isFile(path) {
  return existsSync(path) && statSync(path).isFile();
}

function localCandidates(specifier, parentURL) {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return [];
  }

  const parentDirectory =
    parentURL && parentURL.startsWith("file:") ? dirname(fileURLToPath(parentURL)) : process.cwd();
  const basePath = specifier.startsWith("/") ? specifier : resolvePath(parentDirectory, specifier);

  return [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.mjs`,
    resolvePath(basePath, "index.ts"),
    resolvePath(basePath, "index.tsx"),
    resolvePath(basePath, "index.js"),
    resolvePath(basePath, "index.mjs")
  ];
}

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error.code !== "ERR_MODULE_NOT_FOUND" && error.code !== "ERR_UNSUPPORTED_DIR_IMPORT") {
      throw error;
    }

    const match = localCandidates(specifier, context.parentURL).find(isFile);
    if (!match) {
      throw error;
    }

    return {
      url: pathToFileURL(match).href,
      shortCircuit: true
    };
  }
}

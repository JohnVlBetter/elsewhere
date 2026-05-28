const fs = require("node:fs");
const path = require("node:path");
const { syncBuiltinESMExports } = require("node:module");

function normalizePath(value) {
  return value instanceof URL
    ? value.pathname.replace(/^\/([a-zA-Z]:)/, "$1").replaceAll("/", "\\")
    : String(value);
}

function toPortablePath(value) {
  return normalizePath(value).replaceAll("\\", "/").toLowerCase();
}

function isGeneratedOutputPath(value) {
  const portable = toPortablePath(value);
  return (
    portable.startsWith("apps/web/.next/") ||
    portable.startsWith("apps/web/.next-build/") ||
    portable === "apps/web/.next" ||
    portable === "apps/web/.next-build" ||
    portable.includes("/apps/web/.next/") ||
    portable.includes("/apps/web/.next-build/") ||
    portable.endsWith("/apps/web/.next") ||
    portable.endsWith("/apps/web/.next-build") ||
    portable.startsWith("test-results/") ||
    portable === "test-results" ||
    portable.includes("/test-results/") ||
    portable.endsWith("/test-results") ||
    portable.startsWith("playwright-report/") ||
    portable === "playwright-report" ||
    portable.includes("/playwright-report/") ||
    portable.endsWith("/playwright-report") ||
    portable.startsWith(".tmp/sessions/") ||
    portable === ".tmp/sessions" ||
    portable.includes("/.tmp/sessions/") ||
    portable.endsWith("/.tmp/sessions")
  );
}

function isEperm(error) {
  return error && error.code === "EPERM";
}

function ensureParentDirectory(targetPath) {
  fs.mkdirSync(path.dirname(normalizePath(targetPath)), { recursive: true });
}

function copyPathSync(source, destination) {
  const sourcePath = normalizePath(source);
  const destinationPath = normalizePath(destination);
  ensureParentDirectory(destinationPath);
  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    fs.cpSync(sourcePath, destinationPath, { recursive: true });
    return;
  }

  fs.copyFileSync(sourcePath, destinationPath);
}

function swallowGeneratedEperm(error, targetPath) {
  if (isEperm(error) && isGeneratedOutputPath(targetPath)) {
    return;
  }

  throw error;
}

function installFileSystemFallbacks() {
  const original = {
    renameSync: fs.renameSync,
    rmSync: fs.rmSync,
    rmdirSync: fs.rmdirSync,
    unlinkSync: fs.unlinkSync,
    rename: fs.rename,
    rm: fs.rm,
    rmdir: fs.rmdir,
    unlink: fs.unlink,
    promisesRename: fs.promises.rename.bind(fs.promises),
    promisesRm: fs.promises.rm.bind(fs.promises),
    promisesRmdir: fs.promises.rmdir.bind(fs.promises),
    promisesUnlink: fs.promises.unlink.bind(fs.promises)
  };

  fs.renameSync = function renameSync(source, destination) {
    try {
      return original.renameSync.call(this, source, destination);
    } catch (error) {
      if (isEperm(error) && isGeneratedOutputPath(source) && isGeneratedOutputPath(destination)) {
        return copyPathSync(source, destination);
      }
      throw error;
    }
  };

  for (const method of ["rmSync", "rmdirSync", "unlinkSync"]) {
    fs[method] = function generatedDeleteSync(targetPath, ...args) {
      try {
        return original[method].call(this, targetPath, ...args);
      } catch (error) {
        return swallowGeneratedEperm(error, targetPath);
      }
    };
  }

  fs.rename = function rename(source, destination, callback) {
    return original.rename.call(this, source, destination, (error) => {
      if (error && isEperm(error) && isGeneratedOutputPath(source) && isGeneratedOutputPath(destination)) {
        try {
          copyPathSync(source, destination);
          callback?.(null);
        } catch (copyError) {
          callback?.(copyError);
        }
        return;
      }
      callback?.(error ?? null);
    });
  };

  for (const method of ["rm", "rmdir", "unlink"]) {
    fs[method] = function generatedDelete(targetPath, ...args) {
      const callback = args.pop();
      return original[method].call(this, targetPath, ...args, (error) => {
        if (error && isEperm(error) && isGeneratedOutputPath(targetPath)) {
          callback?.(null);
          return;
        }
        callback?.(error ?? null);
      });
    };
  }

  fs.promises.rename = async function rename(source, destination) {
    try {
      return await original.promisesRename(source, destination);
    } catch (error) {
      if (isEperm(error) && isGeneratedOutputPath(source) && isGeneratedOutputPath(destination)) {
        copyPathSync(source, destination);
        return;
      }
      throw error;
    }
  };

  for (const [method, originalMethod] of [
    ["rm", original.promisesRm],
    ["rmdir", original.promisesRmdir],
    ["unlink", original.promisesUnlink]
  ]) {
    fs.promises[method] = async function generatedDelete(targetPath, ...args) {
      try {
        return await originalMethod(targetPath, ...args);
      } catch (error) {
        return swallowGeneratedEperm(error, targetPath);
      }
    };
  }

  syncBuiltinESMExports();
}

installFileSystemFallbacks();

module.exports = {
  installFileSystemFallbacks,
  isGeneratedOutputPath
};

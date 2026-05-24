const childProcess = require("node:child_process");
const { EventEmitter } = require("node:events");
const { syncBuiltinESMExports } = require("node:module");

const originalExec = childProcess.exec;

function createCompletedProcess(callback) {
  const process = new EventEmitter();
  process.stdout = new EventEmitter();
  process.stderr = new EventEmitter();
  process.stdin = new EventEmitter();
  process.kill = () => true;
  process.killed = false;
  process.pid = 0;

  queueMicrotask(() => {
    callback?.(null, "", "");
    process.emit("exit", 0, null);
    process.emit("close", 0, null);
  });

  return process;
}

childProcess.exec = function exec(command, options, callback) {
  if (typeof options === "function") {
    callback = options;
    options = undefined;
  }

  if (process.platform === "win32" && command === "net use") {
    return createCompletedProcess(callback);
  }

  return originalExec.call(this, command, options, callback);
};

syncBuiltinESMExports();

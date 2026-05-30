import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));

const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: workspaceRoot,
  experimental: {
    webpackBuildWorker: false,
    workerThreads: true
  },
  transpilePackages: [
    "@aigame/shared",
    "@aigame/pack",
    "@aigame/rules",
    "@aigame/agents",
    "@aigame/runtime",
    "@aigame/persistence"
  ]
};

export default nextConfig;

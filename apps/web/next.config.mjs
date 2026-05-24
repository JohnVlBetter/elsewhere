const nextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
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

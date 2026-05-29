const path = require("node:path");
const { startServer } = require("next/dist/server/lib/start-server");
const { configureWebSmokeEnvironment } = require("./web-smoke-env.cjs");

async function readJson(response, label) {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed with ${response.status}: ${text}`);
  }
  return JSON.parse(text);
}

async function main() {
  configureWebSmokeEnvironment(process.env);

  await startServer({
    dir: path.resolve("apps/web"),
    port: 3130,
    hostname: "127.0.0.1",
    isDev: false,
    allowRetry: false
  });

  const baseUrl = "http://127.0.0.1:3130";
  const page = await fetch(baseUrl);
  const pageText = await page.text();
  if (!page.ok || !pageText.includes("</html>")) {
    throw new Error(`Page smoke failed with ${page.status}`);
  }

  const session = await readJson(await fetch(`${baseUrl}/api/session`, { method: "POST" }), "session API");
  if (session.state.currentLocationId !== "foyer") {
    throw new Error(`Expected session to start in foyer, got ${session.state.currentLocationId}`);
  }

  const turn = await readJson(
    await fetch(`${baseUrl}/api/turn`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        inputText: "inspect silver_watch"
      })
    }),
    "turn API"
  );

  if (!turn.state.knownFacts.includes("broken_watch") || turn.acceptedPatches.length !== 1) {
    throw new Error("Expected inspect turn to discover broken_watch with one accepted patch");
  }

  console.log("Web smoke passed: page, session API, and turn API");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

"use client";

import { FormEvent, useEffect, useState } from "react";
import type { SessionState } from "@aigame/shared";

export function GameShell() {
  const [turns, setTurns] = useState<string[]>(["Rain hammers the old tower as the household waits in the foyer."]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [state, setState] = useState<SessionState | undefined>();
  const [trace, setTrace] = useState("No turns submitted.");

  useEffect(() => {
    void fetch("/api/session", { method: "POST" })
      .then((response) => response.json())
      .then((body: { sessionId: string; state: SessionState }) => {
        setSessionId(body.sessionId);
        setState(body.state);
      })
      .catch(() => setTrace("Session API unavailable."));
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!input.trim() || !sessionId) return;
    const response = await fetch("/api/turn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, inputText: input })
    });
    const body = await response.json() as {
      outputText: string;
      state: SessionState;
      acceptedPatches: unknown[];
      rejectedPatches: unknown[];
      trace: { contextIds?: string[]; agentRole?: string; agentRawOutput?: { narration?: string; privateNotes?: string } };
    };
    setState(body.state);
    setTrace(formatTraceSummary(body));
    setTurns((current) => [...current, `> ${input}`, body.outputText]);
    setInput("");
  }

  return (
    <main className="shell">
      <section className="narrative" aria-label="Narrative">
        <h1>Rain Tower Murder</h1>
        <div className="turns">
          {turns.map((turn, index) => (
            <p key={`${index}-${turn}`}>{turn}</p>
          ))}
        </div>
        <form onSubmit={submit} className="action-form">
          <label htmlFor="action-input">Action input</label>
          <div className="action-row">
            <input
              id="action-input"
              aria-label="Action input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="inspect silver_watch"
            />
            <button type="submit">Send</button>
          </div>
        </form>
      </section>
      <aside className="sidebar">
        <section aria-labelledby="current-location-heading">
          <h2 id="current-location-heading">Current Location</h2>
          <p>{state?.currentLocationId ?? "Loading"}</p>
        </section>
        <section aria-labelledby="known-clues-heading">
          <h2 id="known-clues-heading">Known Clues</h2>
          <p>{state && state.knownClues.length > 0 ? state.knownClues.join(", ") : "No clues discovered."}</p>
        </section>
        <section aria-labelledby="inventory-heading">
          <h2 id="inventory-heading">Inventory</h2>
          <p>{state && state.inventory.length > 0 ? state.inventory.join(", ") : "Empty"}</p>
        </section>
        <section aria-labelledby="developer-trace-heading">
          <h2 id="developer-trace-heading">Developer Trace</h2>
          <p>{trace}</p>
        </section>
      </aside>
    </main>
  );
}

function formatTraceSummary(body: {
  acceptedPatches: unknown[];
  rejectedPatches: unknown[];
  trace: { contextIds?: string[]; agentRole?: string; agentRawOutput?: { narration?: string; privateNotes?: string } };
}): string {
  const raw = body.trace.agentRawOutput?.narration ?? body.trace.agentRawOutput?.privateNotes ?? "none";
  return [
    `agent=${body.trace.agentRole ?? "unknown"}`,
    `contexts=${body.trace.contextIds?.join(",") ?? ""}`,
    `accepted=${body.acceptedPatches.length}`,
    `rejected=${body.rejectedPatches.length}`,
    `raw=${raw}`
  ].join("; ");
}

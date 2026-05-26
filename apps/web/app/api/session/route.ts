import { NextResponse } from "next/server";
import { loadWorldPack } from "@aigame/pack";
import { createInitialSessionState } from "@aigame/shared";
import type { WorldPack } from "@aigame/shared";
import { sessionStore } from "../../../src/server/sessionStore";

export async function POST() {
  const pack = loadWorldPack("packs/rain-tower");
  const state = createInitialSessionState(pack);
  const session = sessionStore.createSession({ packId: pack.manifest.id, initialState: state });

  return NextResponse.json({
    sessionId: session.id,
    packId: pack.manifest.id,
    manifest: pack.manifest,
    profile: pack.profile,
    entities: {
      locations: pack.locations.map(({ id, name }) => ({ id, name })),
      characters: pack.characters.map(({ id, name }) => ({ id, name })),
      items: pack.items.map(({ id, name }) => ({ id, name })),
      facts: pack.facts.map(({ id, name }) => ({ id, name })),
      objectives: pack.objectives.map(({ id, name, stages }) => ({ id, name, stages }))
    },
    intro: buildSessionIntro(pack),
    state
  });
}

function buildSessionIntro(pack: WorldPack): string {
  const entryLocation = pack.locations.find((location) => location.id === pack.manifest.entryLocationId);
  const worldText = pack.worldText
    .replace(/^# .+$/m, "")
    .replace(/\s+/g, " ")
    .trim();
  const objectiveNames = pack.objectives.map((objective) => objective.name).join("、");
  const locationText = entryLocation ? `当前地点是${entryLocation.name}。` : "";
  const objectiveText = objectiveNames ? `目标：${objectiveNames}。` : "";
  return `你进入《${pack.manifest.name}》。${worldText} ${locationText}${objectiveText}`.trim();
}

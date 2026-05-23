import { NextResponse } from "next/server";
import { loadWorldPack } from "@aigame/pack";
import { sessionStore } from "../../../src/server/sessionStore";

export async function POST() {
  const pack = loadWorldPack("packs/rain-tower");
  const state = {
    currentLocationId: pack.manifest.entryLocationId,
    turn: 0,
    inventory: [],
    knownClues: [],
    flags: {},
    npcAttitudes: {},
    questStages: Object.fromEntries(pack.quests.map((quest) => [quest.id, quest.initialStage]))
  };
  const session = sessionStore.createSession({ packId: pack.manifest.id, initialState: state });

  return NextResponse.json({
    sessionId: session.id,
    packId: pack.manifest.id,
    state
  });
}

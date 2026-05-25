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
    intro: buildSessionIntro(pack),
    state
  });
}

function buildSessionIntro(pack: ReturnType<typeof loadWorldPack>): string {
  const entryLocation = pack.locations.find((location) => location.id === pack.manifest.entryLocationId);
  const worldText = pack.worldText
    .replace(/^# .+$/m, "")
    .replace(/\s+/g, " ")
    .trim();
  const questNames = pack.quests.map((quest) => quest.name).join("、");
  const locationText = entryLocation ? `当前地点是${entryLocation.name}。` : "";
  const questText = questNames ? `目标：${questNames}。` : "";
  return `你是进入《${pack.manifest.name}》的调查者。${worldText} ${locationText}${questText}先确认自己、现场、人物和时间线。`.trim();
}

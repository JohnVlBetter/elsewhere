import { NextResponse } from "next/server";
import { createInitialSessionState } from "@aigame/shared";
import type { WorldPack } from "@aigame/shared";
import { loadPackById } from "../../../src/server/packRegistry";
import { sessionStore } from "../../../src/server/sessionStore";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const packId = typeof body.packId === "string" && body.packId.trim() ? body.packId.trim() : "rain-tower";
  let pack: WorldPack;
  try {
    pack = loadPackById(packId);
  } catch {
    return NextResponse.json({ error: "没有找到这个故事。" }, { status: 404 });
  }
  const state = createInitialSessionState(pack);
  const session = await sessionStore.createSession({ packId: pack.manifest.id, state });

  return NextResponse.json({
    sessionId: session.id,
    packId: pack.manifest.id,
    manifest: pack.manifest,
    profile: pack.profile,
    entities: {
      locations: pack.locations.map(entitySummary),
      characters: pack.characters.map(entitySummary),
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
  const locationText = entryLocation ? `当前位置是${entryLocation.name}。` : "";
  const objectiveText = objectiveNames ? `目标：${objectiveNames}。` : "";
  return `你进入《${pack.manifest.name}》。${worldText} ${locationText}${objectiveText}`.trim();
}

function entitySummary(entity: { id: string; name: string; assets?: unknown }) {
  const { id, name, assets } = entity;
  return isRecord(assets) ? { id, name, assets } : { id, name };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

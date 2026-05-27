import { listWorldPackSummaries, loadWorldPack } from "@aigame/pack";

export async function listAvailablePacks() {
  return listWorldPackSummaries("packs");
}

export function loadPackById(packId: string) {
  if (!/^[a-z0-9-]+$/i.test(packId)) {
    throw new Error(`Invalid pack id: ${packId}`);
  }

  return loadWorldPack(`packs/${packId}`);
}

import { EndingDef, SessionState, WorldPack } from "@aigame/shared";
import { evaluateCondition } from "./conditions";

export function judgeEnding(pack: WorldPack, state: SessionState): EndingDef | undefined {
  return [...pack.endings]
    .filter((ending) => evaluateCondition(ending.condition, state))
    .sort((left, right) => right.priority - left.priority)[0];
}

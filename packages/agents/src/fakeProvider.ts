import type { GamePatch } from "@aigame/shared";
import type { ModelProvider } from "./modelProvider";

export interface AgentResponse {
  narration: string;
  spokenBy: Array<{ npcId: string; text: string }>;
  proposedPatches: GamePatch[];
  privateNotes: string;
}

export class FakeModelProvider implements ModelProvider {
  constructor(private readonly response: AgentResponse = {
    narration: "现场暂时没有新的变化。",
    spokenBy: [],
    proposedPatches: [],
    privateNotes: "fake response"
  }) {}

  async generateStructured<T>(): Promise<T> {
    return this.response as T;
  }
}

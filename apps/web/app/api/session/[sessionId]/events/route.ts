import { NextResponse } from "next/server";
import { sessionStore } from "../../../../../src/server/sessionStore";

export async function GET(_: Request, context: { params: { sessionId: string } }) {
  const events = await sessionStore.listTimelineEvents(context.params.sessionId);
  return NextResponse.json({ events: events.filter((event) => event.visibleToPlayer) });
}

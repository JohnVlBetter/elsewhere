import { NextRequest, NextResponse } from "next/server";
import { formatTurnFailure, parseTurnRequestBody, runStoredTurn, TurnRequestError } from "../../../src/server/turnService";

export async function POST(request: NextRequest) {
  try {
    const body = parseTurnRequestBody(await readJsonBody(request));
    const result = await runStoredTurn(body, undefined, request.signal);
    return NextResponse.json(result);
  } catch (error) {
    const failure = formatTurnFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new TurnRequestError("Invalid turn request", 400);
  }
}

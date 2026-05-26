import { NextRequest, NextResponse } from "next/server";
import { formatTurnFailure, parseTurnRequestBody, runStoredTurn } from "../../../src/server/turnService";

export async function POST(request: NextRequest) {
  try {
    const body = parseTurnRequestBody(await request.json());
    const result = await runStoredTurn(body);
    return NextResponse.json(result);
  } catch (error) {
    const failure = formatTurnFailure(error);
    return NextResponse.json({ error: failure.error }, { status: failure.status });
  }
}

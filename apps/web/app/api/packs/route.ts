import { NextResponse } from "next/server";
import { listAvailablePacks } from "../../../src/server/packRegistry";

export async function GET() {
  const packs = await listAvailablePacks();
  return NextResponse.json({ packs });
}

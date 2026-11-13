import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser } from "@/server/auth";
import { readStateForUser, stateVisibleToUser } from "@/server/application-state";
import { queueCompletedReadingBookings } from "./reading-bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const { state, initialized } = await readStateForUser(user);
    const visibleState = structuredClone(state);
    queueCompletedReadingBookings(visibleState);
    return NextResponse.json({ db: stateVisibleToUser(visibleState, user), initialized });
  } catch (error) {
    console.error("[state/read]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not load app data from MySQL." }, { status: 503 });
  }
}

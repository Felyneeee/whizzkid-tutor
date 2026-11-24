import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser } from "@/server/auth";
import { initializeApplicationState, stateVisibleToUser } from "@/server/application-state";
import { readJson, RequestBodyError } from "@/server/request-guards";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Only an administrator can initialize shared app data." }, { status: 403 });
    }
    const body = await readJson(request, 2 * 1024 * 1024);
    const state = await initializeApplicationState(body.db, user);
    return NextResponse.json({ db: stateVisibleToUser(state, user), initialized: true });
  } catch (error) {
    if (error instanceof RequestBodyError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[state/initialize]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not initialize the MySQL app state." }, { status: 503 });
  }
}

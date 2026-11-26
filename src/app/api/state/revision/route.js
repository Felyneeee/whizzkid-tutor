import { NextResponse } from "next/server";
import { authenticatedUser } from "@/server/auth";
import { mysqlPool } from "@/server/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });

    const [rows] = await mysqlPool.execute("SELECT revision FROM application_state WHERE id = 1");
    return NextResponse.json(
      { revision: Number(rows[0]?.revision ?? 0) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[state/revision]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not check app state revision." }, { status: 503 });
  }
}

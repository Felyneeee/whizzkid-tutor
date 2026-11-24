import { NextResponse } from "next/server";
import { mysqlPool } from "@/server/mysql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [rows] = await mysqlPool.execute(
      "SELECT id, title, description AS `desc` FROM hirings WHERE open = TRUE ORDER BY title, id",
    );
    return NextResponse.json({ hirings: rows });
  } catch {
    return NextResponse.json({ error: "Could not load current hiring opportunities." }, { status: 503 });
  }
}

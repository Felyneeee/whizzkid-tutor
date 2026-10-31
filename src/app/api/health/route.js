import { NextResponse } from "next/server";
import { mysqlPool } from "@/server/mysql";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
    try {
        const [rows] = await mysqlPool.query("SELECT DATABASE() AS database_name");
        const connected = rows[0]?.database_name === "whizzkids";
        return NextResponse.json({ ok: connected, database: connected ? rows[0].database_name : null }, { status: connected ? 200 : 503 });
    }
    catch {
        return NextResponse.json({ ok: false, error: "Database connection failed. Check the local server and DATABASE_URL." }, { status: 503 });
    }
}

import { NextResponse } from "next/server";
import { clearSession } from "@/server/auth";
export const runtime = "nodejs";
export async function POST(request) {
    const response = NextResponse.json({ ok: true });
    try {
        await clearSession(request, response);
        return response;
    }
    catch {
        return NextResponse.json({ error: "Could not end the session." }, { status: 503 });
    }
}

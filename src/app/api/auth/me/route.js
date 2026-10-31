import { NextResponse } from "next/server";
import { authenticatedUser } from "@/server/auth";
export const runtime = "nodejs";
export async function GET(request) {
    try {
        const user = await authenticatedUser(request);
        if (!user)
            return NextResponse.json({ user: null }, { status: 401 });
        return NextResponse.json({ user });
    }
    catch {
        return NextResponse.json({ error: "Could not check the session." }, { status: 503 });
    }
}

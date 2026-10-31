import { NextResponse } from "next/server";
import { findLoginUser, issueSession, publicUser, verifyPassword } from "@/server/auth";
export const runtime = "nodejs";
export async function POST(request) {
    try {
        const body = await request.json();
        const identifier = typeof body.identifier === "string" ? body.identifier : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!identifier || !password) {
            return NextResponse.json({ error: "Enter your email/username and password." }, { status: 400 });
        }
        const row = await findLoginUser(identifier);
        if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) {
            return NextResponse.json({ error: "Email/username or password is incorrect." }, { status: 401 });
        }
        const response = NextResponse.json({ user: publicUser(row) });
        await issueSession(row.id, response);
        return response;
    }
    catch (error) {
        // Log diagnostic text only; never log request bodies or password hashes.
        const cause = error;
        console.error("[auth/login] Database operation failed", cause.code ?? "UNKNOWN", cause.message ?? "No error detail");
        return NextResponse.json({ error: "Could not log in. Check the database connection and try again." }, { status: 503 });
    }
}

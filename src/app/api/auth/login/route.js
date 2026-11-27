import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { findLoginUser, issueSession, publicUser, verifyPassword } from "@/server/auth";
import { mysqlPool } from "@/server/mysql";
import { checkRateLimit, rateLimitStatus, readJson, RequestBodyError } from "@/server/request-guards";
export const runtime = "nodejs";
export async function POST(request) {
    try {
        const body = await readJson(request, 8 * 1024);
        const identifier = typeof body.identifier === "string" ? body.identifier : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!identifier || !password) {
            return NextResponse.json({ error: "Enter your email/username and password." }, { status: 400 });
        }
        const ipLimit = await rateLimitStatus(request, "login-ip", "all", 100, 15 * 60 * 1000);
        const normalizedIdentifier = identifier.trim().toLowerCase();
        const accountLimit = await rateLimitStatus(request, "login-account", normalizedIdentifier, 5, 15 * 60 * 1000);
        if (!ipLimit.allowed || !accountLimit.allowed) {
            const retryAfter = Math.max(ipLimit.retryAfter, accountLimit.retryAfter);
            return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(retryAfter) } });
        }
        const row = await findLoginUser(identifier);
        if (!row?.password_hash || !(await verifyPassword(password, row.password_hash))) {
            await checkRateLimit(request, "login-ip", "all", 100, 15 * 60 * 1000);
            await checkRateLimit(request, "login-account", normalizedIdentifier, 5, 15 * 60 * 1000);
            return NextResponse.json({ error: "Email/username or password is incorrect." }, { status: 401 });
        }
        await mysqlPool.query(
            "INSERT INTO activities (id, user_id, kind, activity_text, created_at) VALUES (?, ?, 'other', 'Logged in', UTC_TIMESTAMP())",
            [randomUUID(), row.id],
        );
        const response = NextResponse.json({ user: publicUser(row) });
        await issueSession(row.id, response);
        return response;
    }
    catch (error) {
        if (error instanceof RequestBodyError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        // Log diagnostic text only; never log request bodies or password hashes.
        const cause = error;
        console.error("[auth/login] Database operation failed", cause.code ?? "UNKNOWN", cause.message ?? "No error detail");
        return NextResponse.json({ error: "Could not log in. Check the database connection and try again." }, { status: 503 });
    }
}

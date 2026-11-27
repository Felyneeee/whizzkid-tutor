import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPassword, issueSession } from "@/server/auth";
import { mysqlPool } from "@/server/mysql";
import { checkRateLimit, readJson, RequestBodyError } from "@/server/request-guards";
export const runtime = "nodejs";
export async function POST(request) {
    let connection;
    try {
        const body = await readJson(request, 16 * 1024);
        const limit = await checkRateLimit(request, "register-tutee", "all", 10, 60 * 60 * 1000);
        if (!limit.allowed) {
            return NextResponse.json({ error: "Too many registration attempts. Try again later." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
        }
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
        }
        if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
            return NextResponse.json({ error: "Username must be 3–32 characters using letters, numbers, _ or -." }, { status: 400 });
        }
        if (password.length < 12 || password.length > 128) {
            return NextResponse.json({ error: "Use a password between 12 and 128 characters." }, { status: 400 });
        }
        const id = randomUUID();
        const createdAt = new Date();
        const passwordHash = await hashPassword(password);
        connection = await mysqlPool.getConnection();
        await connection.beginTransaction();
        await connection.execute("INSERT INTO users (id, role, email, username, password_hash) VALUES (?, 'tutee', ?, ?, ?)", [id, email, username, passwordHash]);
        await connection.execute("INSERT INTO tutee_profiles (user_id) VALUES (?)", [id]);
        const user = { id, role: "tutee", email, username, createdAt: createdAt.toISOString() };
        const response = NextResponse.json({ user }, { status: 201 });
        await issueSession(id, response, connection);
        await connection.commit();
        return response;
    }
    catch (error) {
        if (error instanceof RequestBodyError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        if (connection)
            await connection.rollback().catch(() => undefined);
        console.error("Tutee registration failed:", {
            code: error?.code,
            sqlState: error?.sqlState,
            message: error?.message,
        });
        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json({ error: "That email or username is already registered." }, { status: 409 });
        }
        return NextResponse.json({ error: "Could not create the account. Check the database setup and try again." }, { status: 503 });
    }
    finally {
        connection?.release();
    }
}

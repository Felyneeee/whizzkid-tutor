import "server-only";
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { mysqlPool } from "@/server/mysql";
const scrypt = promisify(scryptCallback);
export const SESSION_COOKIE = "whizzkids_session";
const SESSION_DAYS = 30;
function publicUser(row) {
    return {
        id: row.id,
        role: row.role,
        email: row.email,
        username: row.username,
        createdAt: new Date(row.created_at).toISOString(),
    };
}
export async function hashPassword(password) {
    const salt = randomBytes(16);
    const derived = (await scrypt(password, salt, 64));
    return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}
export async function verifyPassword(password, encoded) {
    const [scheme, saltHex, hashHex] = encoded.split("$");
    if (scheme !== "scrypt" || !saltHex || !hashHex)
        return false;
    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== 64)
        return false;
    const actual = (await scrypt(password, Buffer.from(saltHex, "hex"), expected.length));
    return timingSafeEqual(actual, expected);
}
function tokenHash(token) {
    return createHash("sha256").update(token).digest("hex");
}
export async function issueSession(userId, response) {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await mysqlPool.execute("INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)", [tokenHash(token), userId, expiresAt]);
    response.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        expires: expiresAt,
    });
}
export async function clearSession(request, response) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token) {
        await mysqlPool.execute("DELETE FROM auth_sessions WHERE token_hash = ?", [tokenHash(token)]);
    }
    response.cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 0,
    });
}
export async function authenticatedUser(request) {
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (!token)
        return null;
    const [rows] = await mysqlPool.execute(`SELECT u.id, u.role, u.email, u.username, u.created_at
       FROM auth_sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > CURRENT_TIMESTAMP LIMIT 1`, [tokenHash(token)]);
    return rows[0] ? publicUser(rows[0]) : null;
}
export async function findLoginUser(identifier) {
    const [rows] = await mysqlPool.execute(`SELECT id, role, email, username, created_at, password_hash
       FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1`, [identifier.trim().toLowerCase(), identifier.trim().toLowerCase()]);
    return rows[0] ?? null;
}
export { publicUser };

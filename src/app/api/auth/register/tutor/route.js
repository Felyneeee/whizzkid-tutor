import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPassword, issueSession } from "@/server/auth";
import { mysqlPool } from "@/server/mysql";
import { isValidPdfDataUrl } from "@/lib/resumes";
export const runtime = "nodejs";
export async function POST(request) {
    let connection;
    try {
        const body = await request.json();
        const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
        const username = typeof body.username === "string" ? body.username.trim() : "";
        const password = typeof body.password === "string" ? body.password : "";
        const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
        const contact = typeof body.contact === "string" ? body.contact.trim() : "";
        const applicantType = body.applicantType === "existing" ? "existing" : "new";
        const age = Number.isInteger(body.age) && body.age >= 18 && body.age <= 80 ? body.age : null;
        const birthday = typeof body.birthday === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.birthday) ? body.birthday : null;
        const photo = typeof body.photo === "string" ? body.photo : "";
        const resumeName = typeof body.resumeName === "string" ? body.resumeName.slice(0, 255) : "";
        const resumeData = typeof body.resumeData === "string" ? body.resumeData : "";
        const bio = typeof body.bio === "string" ? body.bio.slice(0, 4000) : "";
        const subjects = Array.isArray(body.subjects) ? body.subjects.filter((x) => typeof x === "string").slice(0, 30) : [];
        const gradeBands = Array.isArray(body.gradeBands) ? body.gradeBands.filter((x) => typeof x === "string").slice(0, 10) : [];
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
            return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
        }
        if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
            return NextResponse.json({ error: "Username must be 3–32 characters using letters, numbers, _ or -." }, { status: 400 });
        }
        if (password.length < 12 || password.length > 128) {
            return NextResponse.json({ error: "Use a password between 12 and 128 characters." }, { status: 400 });
        }
        if (!fullName || fullName.length > 200 || !contact || !age || !birthday || !subjects.length || !gradeBands.length) {
            return NextResponse.json({ error: "Complete all required tutor application fields." }, { status: 400 });
        }
        if ((applicantType === "new" && !resumeData) || (resumeData && !isValidPdfDataUrl(resumeData))) {
            return NextResponse.json({ error: "Upload a valid PDF resume no larger than 1.5 MB." }, { status: 400 });
        }
        if (photo.length > 2000000) {
            return NextResponse.json({ error: "Profile photo is too large." }, { status: 400 });
        }
        const id = randomUUID();
        const createdAt = new Date();
        const passwordHash = await hashPassword(password);
        connection = await mysqlPool.getConnection();
        await connection.beginTransaction();
        await connection.execute("INSERT INTO users (id, role, email, username, password_hash) VALUES (?, 'tutor', ?, ?, ?)", [id, email, username, passwordHash]);
        await connection.execute(`INSERT INTO tutor_profiles
         (user_id, applicant_type, status, full_name, photo, age, contact, resume_name, resume_data,
          bio, subjects, grade_bands, birthday)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, applicantType, applicantType === "new" ? "pending_review" : "pending_verification",
            fullName, photo, age, contact, resumeName, resumeData, bio,
            JSON.stringify(subjects), JSON.stringify(gradeBands), birthday]);
        const [appStateRows] = await connection.query("SELECT id FROM application_state WHERE id = 1 FOR UPDATE");
        if (appStateRows.length) {
            const createdAtText = createdAt.toISOString().slice(0, 19).replace("T", " ");
            const adminText = `${applicantType === "new" ? "New tutor application" : "Existing tutor registration"} from ${fullName}`;
            const [admins] = await connection.query("SELECT id FROM users WHERE role = 'admin'");
            const notificationRows = admins.map((admin) => [
                randomUUID(), admin.id, adminText, createdAtText, JSON.stringify(["web"]),
            ]);
            notificationRows.push([
                randomUUID(), id,
                applicantType === "new" ? "Application received. Status: Pending Review." : "Registration received. Status: Pending Verification.",
                createdAtText, JSON.stringify(["web"]),
            ]);
            for (const row of notificationRows) {
                await connection.execute(
                    "INSERT INTO notifications (id, user_id, notification_text, created_at, channels) VALUES (?, ?, ?, ?, ?)",
                    row,
                );
            }
            await connection.execute("UPDATE application_state SET revision = revision + 1 WHERE id = 1");
        }
        await connection.commit();
        const user = { id, role: "tutor", email, username, createdAt: createdAt.toISOString() };
        const response = NextResponse.json({ user }, { status: 201 });
        await issueSession(id, response);
        return response;
    }
    catch (error) {
        if (connection)
            await connection.rollback().catch(() => undefined);
        if (error.code === "ER_DUP_ENTRY") {
            return NextResponse.json({ error: "That email or username is already registered." }, { status: 409 });
        }
        return NextResponse.json({ error: "Could not create the account. Check the database setup and try again." }, { status: 503 });
    }
    finally {
        connection?.release();
    }
}

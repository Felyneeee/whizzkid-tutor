import "server-only";
import { buildSeed } from "@/lib/seed";
import { isBirthdayToday, nowISO, uid } from "@/lib/dates";
import { mysqlPool } from "@/server/mysql";
import {
  hasLegacyRelationalData,
  loadRelationalState,
  persistRelationalState,
} from "@/server/relational-state";

function jsonValue(value, fallback) {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return value;
}

function publicUser(row) {
  return {
    id: row.id,
    role: row.role,
    email: row.email,
    username: row.username,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function remapLegacyUserIds(connection, state, adminUser) {
  const [rows] = await connection.query("SELECT id, role, email, username FROM users");
  const byId = new Map(rows.map((row) => [row.id, row]));
  const byEmail = new Map(rows.map((row) => [`${row.role}:${row.email.toLowerCase()}`, row]));
  const byUsername = new Map(rows.map((row) => [`${row.role}:${row.username.toLowerCase()}`, row]));
  const currentAdminId = adminUser?.id ?? rows.find((row) => row.role === "admin")?.id ?? "u_admin";
  const replacements = new Map([["u_admin", currentAdminId]]);

  for (const legacyUser of state.users ?? []) {
    const account = byId.get(legacyUser.id)
      ?? byEmail.get(`${legacyUser.role}:${String(legacyUser.email ?? "").toLowerCase()}`)
      ?? byUsername.get(`${legacyUser.role}:${String(legacyUser.username ?? "").toLowerCase()}`);
    if (account) replacements.set(legacyUser.id, account.id);
  }

  const replaceIds = (value) => {
    if (typeof value === "string") return replacements.get(value) ?? value;
    if (Array.isArray(value)) return value.map(replaceIds);
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceIds(item)]));
    }
    return value;
  };
  const normalized = replaceIds(state);
  const accountIds = new Set(rows.map((row) => row.id));
  normalized.users = (normalized.users ?? []).filter((entry) => accountIds.has(entry.id));
  return normalized;
}

async function mergeAccountTables(connection, state) {
  const [users] = await connection.query(
    "SELECT id, role, email, username, created_at FROM users ORDER BY created_at",
  );
  if (users.some((row) => row.role === "admin" && row.id !== "u_admin")) {
    state.users = state.users.filter((entry) => entry.id !== "u_admin");
  }
  for (const row of users) {
    const user = publicUser(row);
    const index = state.users.findIndex((entry) => entry.id === user.id);
    if (index < 0) state.users.push(user);
    else state.users[index] = user;
  }

  const [tuteeRows] = await connection.query("SELECT * FROM tutee_profiles");
  for (const row of tuteeRows) {
    if (!state.tutees.some((profile) => profile.userId === row.user_id)) {
      state.tutees.push({
        userId: row.user_id, fullName: row.full_name, age: row.age,
        birthday: row.birthday ? String(row.birthday).slice(0, 10) : "",
        gradeLevel: row.grade_level, contact: row.contact,
        guardianName: row.guardian_name, complete: Boolean(row.complete),
        lastGreetingYear: row.last_greeting_year ?? undefined,
      });
    }
  }

  const [tutorRows] = await connection.query("SELECT * FROM tutor_profiles");
  for (const row of tutorRows) {
    if (!state.tutors.some((profile) => profile.userId === row.user_id)) {
      state.tutors.push({
        userId: row.user_id, applicantType: row.applicant_type, status: row.status,
        fullName: row.full_name, photo: row.photo, age: row.age, contact: row.contact,
        resumeName: row.resume_name, resumeData: row.resume_data, bio: row.bio,
        subjects: jsonValue(row.subjects, []), gradeBands: jsonValue(row.grade_bands, []),
        hourlyRate: Number(row.hourly_rate), fixedSalary: Number(row.fixed_salary),
        interviewAt: row.interview_at ? new Date(row.interview_at).toISOString() : undefined,
        interviewNotes: row.interview_notes ?? undefined,
        rejectionReason: row.rejection_reason ?? undefined,
        birthday: row.birthday ? String(row.birthday).slice(0, 10) : undefined,
        lastGreetingYear: row.last_greeting_year ?? undefined,
      });
    }
  }

  return state;
}

export async function readApplicationState(connection, { lock = false, create = false } = {}) {
  const suffix = lock ? " FOR UPDATE" : "";
  const [rows] = await connection.query(`SELECT state_json, revision FROM application_state WHERE id = 1${suffix}`);
  let initialized = rows.length > 0;
  const legacyState = initialized ? jsonValue(rows[0].state_json, buildSeed()) : null;
  let state = legacyState ?? buildSeed();
  state = { ...buildSeed(), ...state };
  for (const [key, empty] of Object.entries(buildSeed())) {
    if (Array.isArray(empty)) {
      if (!Array.isArray(state[key])) state[key] = empty;
    } else if (!state[key] || typeof state[key] !== "object" || Array.isArray(state[key])) {
      state[key] = empty;
    }
  }
  if (initialized && hasLegacyRelationalData(legacyState)) {
    state = await remapLegacyUserIds(connection, state);
  }
  await mergeAccountTables(connection, state);
  const loaded = await loadRelationalState(connection, state);
  state = loaded.state;

  if (initialized && hasLegacyRelationalData(legacyState)) {
    await persistRelationalState(connection, state, loaded.persistedState);
    await connection.execute(
      "UPDATE application_state SET state_json = '{}', revision = revision + 1 WHERE id = 1",
    );
  }

  if (create && !initialized) {
    await connection.execute(
      "INSERT IGNORE INTO application_state (id, state_json, revision) VALUES (1, '{}', 1)",
    );
    initialized = true;
  }

  return { state, initialized };
}

export async function readCurrentApplicationState() {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await readApplicationState(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export function runBirthdayGreetings(state) {
  const year = new Date().getFullYear();
  const due = [
    ...state.tutees.filter((profile) => isBirthdayToday(profile.birthday) && profile.lastGreetingYear !== year)
      .map((profile) => ({ kind: "tutee", id: profile.userId, name: profile.fullName })),
    ...state.tutors.filter((profile) => profile.birthday && isBirthdayToday(profile.birthday) && profile.lastGreetingYear !== year)
      .map((profile) => ({ kind: "tutor", id: profile.userId, name: profile.fullName })),
  ];
  if (!due.length) return false;
  const adminId = state.users.find((entry) => entry.role === "admin")?.id || "u_admin";
  for (const person of due) {
    state.messages.push({
      id: uid("m"), threadId: person.id, fromId: adminId,
      text: `🎂 Happy Birthday, ${person.name.split(" ")[0]}! All of us at Whizzkids wish you a day full of joy and learning.`,
      at: nowISO(), auto: true,
    });
    const profile = person.kind === "tutee"
      ? state.tutees.find((entry) => entry.userId === person.id)
      : state.tutors.find((entry) => entry.userId === person.id);
    if (profile) profile.lastGreetingYear = year;
  }
  return true;
}

export async function readStateForUser(user) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await readApplicationState(connection, { lock: true });
    const previousState = structuredClone(result.state);
    if (user.role === "admin" && result.initialized && runBirthdayGreetings(result.state)) {
      await persistRelationalState(connection, result.state, previousState);
      await connection.execute(
        "UPDATE application_state SET revision = revision + 1 WHERE id = 1",
      );
    }
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export async function initializeApplicationState(importedState, user) {
  const connection = await mysqlPool.getConnection();
  try {
    await connection.beginTransaction();
    const initial = buildSeed();
    await mergeAccountTables(connection, initial);
    const [insertResult] = await connection.execute(
      "INSERT IGNORE INTO application_state (id, state_json, revision) VALUES (1, '{}', 1)",
    );
    if (!insertResult.affectedRows) {
      const current = await readApplicationState(connection, { lock: true });
      await connection.commit();
      return current.state;
    }

    const state = importedState && typeof importedState === "object" ? importedState : initial;
    const seed = buildSeed();
    const safeState = { ...seed, ...state };
    for (const [key, empty] of Object.entries(seed)) {
      if (Array.isArray(empty)) {
        if (!Array.isArray(safeState[key])) safeState[key] = empty;
      } else if (!safeState[key] || typeof safeState[key] !== "object" || Array.isArray(safeState[key])) {
        safeState[key] = empty;
      }
    }
    safeState.users = Array.isArray(safeState.users) ? safeState.users : [];
    safeState.users = safeState.users.map((entry) => {
      const { password, ...userRecord } = entry ?? {};
      return userRecord;
    });

    const normalized = await remapLegacyUserIds(connection, safeState, user);
    normalized.users = normalized.users.filter((entry) => entry.id !== user.id);
    normalized.users.unshift(user);
    await mergeAccountTables(connection, normalized);
    await persistRelationalState(connection, normalized, initial);
    await connection.execute(
      "UPDATE application_state SET state_json = '{}', revision = revision + 1 WHERE id = 1",
    );
    await connection.commit();
    return normalized;
  } catch (error) {
    await connection.rollback().catch(() => undefined);
    throw error;
  } finally {
    connection.release();
  }
}

export function stateVisibleToUser(state, user) {
  if (user.role === "admin") return state;
  const visible = structuredClone(state);
  const ownBookings = state.bookings.filter((booking) => booking.tuteeId === user.id || booking.tutorId === user.id);
  const ownSessions = state.sessions.filter((session) => session.tuteeId === user.id || session.tutorId === user.id);
  const tuteeIds = new Set([user.id, ...ownBookings.map((booking) => booking.tuteeId), ...ownSessions.map((session) => session.tuteeId)]);
  const tutorIds = new Set([user.id, ...ownBookings.map((booking) => booking.tutorId), ...ownSessions.map((session) => session.tutorId)]);
  const activeTutorIds = new Set(state.tutors.filter((tutor) => tutor.status === "active").map((tutor) => tutor.userId));

  visible.users = state.users
    .filter((entry) => entry.role === "admin" || tuteeIds.has(entry.id) || tutorIds.has(entry.id) || (user.role === "tutee" && activeTutorIds.has(entry.id)))
    .map((entry) => entry.id === user.id ? entry : { ...entry, email: "", username: entry.role === "admin" ? "Admin" : entry.role === "tutor" ? "Tutor" : "Tutee" });
  visible.tutees = state.tutees.filter((profile) => tuteeIds.has(profile.userId));
  visible.tutors = state.tutors.filter((profile) => tutorIds.has(profile.userId) || (user.role === "tutee" && profile.status === "active"))
    .map((profile) => user.role === "tutee" && profile.userId !== user.id
      ? { ...profile, contact: "", resumeName: "", resumeData: "", hourlyRate: 0, fixedSalary: 0, interviewNotes: undefined, rejectionReason: undefined }
      : profile);
  visible.bookings = ownBookings;
  visible.sessions = ownSessions;
  visible.progressReports = state.progressReports.filter((report) => tuteeIds.has(report.tuteeId) || tutorIds.has(report.tutorId));
  visible.assessments = user.role === "tutee" ? state.assessments.filter((item) => item.tuteeId === user.id) : [];
  visible.availability = state.availability.filter((item) => item.status === "approved" && (tutorIds.has(item.tutorId) || (user.role === "tutee" && activeTutorIds.has(item.tutorId))));
  if (user.role === "tutor") {
    visible.tutorSchedules = state.tutorSchedules?.[user.id] ? { [user.id]: state.tutorSchedules[user.id] } : {};
  }
  visible.leaves = user.role === "tutor" ? state.leaves.filter((item) => item.tutorId === user.id) : [];
  visible.messages = state.messages.filter((message) => message.threadId === user.id);
  visible.notifications = state.notifications.filter((item) => item.userId === user.id);
  visible.purchases = state.purchases.filter((item) => item.tuteeId === user.id);
  visible.materials = state.materials.filter((item) => !item.revoked && (!Array.isArray(item.allowedUserIds) || item.allowedUserIds.length === 0 || item.allowedUserIds.includes(user.id)) && (user.role === "tutor" ? item.allowTutors : item.allowTutees));
  visible.materialLogs = state.materialLogs.filter((item) => item.userId === user.id);
  visible.activities = state.activities.filter((item) => item.userId === user.id);
  visible.cohorts = state.cohorts.map((cohort) => ({
    ...cohort,
    enrolled: cohort.enrolled.map((id, index) => id === user.id ? id : `occupied-${index}`),
  }));
  visible.hirings = state.hirings;
  return visible;
}

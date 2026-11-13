import "server-only";

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function sqlDateTime(value) {
  if (!value) return null;
  const text = value instanceof Date ? value.toISOString() : String(value);
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date-time: ${value}`);
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function isoDateTime(value) {
  if (!value) return undefined;
  const text = value instanceof Date ? value.toISOString() : String(value);
  const date = new Date(/(?:Z|[+-]\d\d:\d\d)$/.test(text) ? text : `${text.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date-time from MySQL: ${value}`);
  return date.toISOString();
}

function dateOnly(value) {
  return value == null ? undefined : String(value).slice(0, 10);
}

function jsonText(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

const tables = [
  {
    stateKey: "tutees",
    table: "tutee_profiles",
    primaryKey: "user_id",
    toRow: (p) => ({
      user_id: p.userId, full_name: p.fullName ?? "", age: p.age ?? null,
      birthday: p.birthday || null, grade_level: p.gradeLevel ?? "", contact: p.contact ?? "",
      guardian_name: p.guardianName ?? "", complete: Boolean(p.complete),
      last_greeting_year: p.lastGreetingYear ?? null,
    }),
    fromRow: (r) => ({
      userId: r.user_id, fullName: r.full_name, age: r.age == null ? null : Number(r.age),
      birthday: dateOnly(r.birthday) ?? "", gradeLevel: r.grade_level, contact: r.contact,
      guardianName: r.guardian_name, complete: Boolean(r.complete),
      ...(r.last_greeting_year == null ? {} : { lastGreetingYear: Number(r.last_greeting_year) }),
    }),
  },
  {
    stateKey: "tutors",
    table: "tutor_profiles",
    primaryKey: "user_id",
    toRow: (p) => ({
      user_id: p.userId, applicant_type: p.applicantType ?? "new",
      status: p.status ?? "pending_review", full_name: p.fullName ?? "", photo: p.photo ?? "",
      age: p.age ?? null, contact: p.contact ?? "", resume_name: p.resumeName ?? "",
      resume_data: p.resumeData ?? "", bio: p.bio ?? "",
      subjects: jsonText(p.subjects, []), grade_bands: jsonText(p.gradeBands, []),
      hourly_rate: p.hourlyRate ?? 0, fixed_salary: p.fixedSalary ?? 0,
      interview_at: sqlDateTime(p.interviewAt), interview_notes: p.interviewNotes ?? null,
      rejection_reason: p.rejectionReason ?? null, birthday: p.birthday || null,
      last_greeting_year: p.lastGreetingYear ?? null,
    }),
    fromRow: (r) => ({
      userId: r.user_id, applicantType: r.applicant_type, status: r.status,
      fullName: r.full_name, photo: r.photo, age: r.age == null ? null : Number(r.age),
      contact: r.contact, resumeName: r.resume_name, resumeData: r.resume_data,
      bio: r.bio, subjects: parseJson(r.subjects, []), gradeBands: parseJson(r.grade_bands, []),
      hourlyRate: Number(r.hourly_rate), fixedSalary: Number(r.fixed_salary),
      ...(r.interview_at ? { interviewAt: isoDateTime(r.interview_at) } : {}),
      ...(r.interview_notes == null ? {} : { interviewNotes: r.interview_notes }),
      ...(r.rejection_reason == null ? {} : { rejectionReason: r.rejection_reason }),
      ...(r.birthday == null ? {} : { birthday: dateOnly(r.birthday) }),
      ...(r.last_greeting_year == null ? {} : { lastGreetingYear: Number(r.last_greeting_year) }),
    }),
  },
  {
    stateKey: "availability", table: "availability", primaryKey: "id",
    orderBy: "submitted_at DESC",
    toRow: (a) => ({
      id: a.id, batch_id: a.batchId, tutor_id: a.tutorId, slot_date: a.date,
      slots: jsonText(a.slots, []), modalities: jsonText(a.modalities, []),
      status: a.status, submitted_at: sqlDateTime(a.submittedAt), note: a.note ?? null,
    }),
    fromRow: (r) => ({
      id: r.id, batchId: r.batch_id, tutorId: r.tutor_id, date: dateOnly(r.slot_date),
      slots: parseJson(r.slots, []), modalities: parseJson(r.modalities, []), status: r.status,
      submittedAt: isoDateTime(r.submitted_at), ...(r.note == null ? {} : { note: r.note }),
    }),
  },
  {
    stateKey: "cohorts", table: "cohorts", primaryKey: "id",
    toRow: (c) => ({
      id: c.id, label: c.label, start_date: c.startDate,
      weekdays: jsonText(c.weekdays, []), class_time: c.time,
      modality: c.modality ?? null, capacity: c.capacity, enrolled: jsonText(c.enrolled, []),
      tutor_id: c.tutorId ?? null, sessions_count: c.sessionsCount, assignment_mode: c.assignmentMode ?? "automatic", rotation_order: jsonText(c.rotationOrder, {}), weekday_tutor_ids: jsonText(c.weekdayTutorIds, {}),
    }),
    fromRow: (r) => ({
      id: r.id, label: r.label, startDate: dateOnly(r.start_date),
      weekdays: parseJson(r.weekdays, []), time: r.class_time, modality: r.modality,
      capacity: Number(r.capacity), enrolled: parseJson(r.enrolled, []),
      tutorId: r.tutor_id, sessionsCount: Number(r.sessions_count), assignmentMode: r.assignment_mode ?? "automatic", rotationOrder: parseJson(r.rotation_order, {}), weekdayTutorIds: parseJson(r.weekday_tutor_ids, {}),
    }),
  },
  {
    stateKey: "assessments", table: "assessments", primaryKey: "id",
    toRow: (a) => ({
      id: a.id, tutee_id: a.tuteeId, modality: a.modality, assessment_date: a.date ?? null,
      assessment_time: a.time ?? null, status: a.status, results: a.results ?? null,
      learning_needs: a.learningNeeds ?? null, reading_level: a.readingLevel ?? null,
    }),
    fromRow: (r) => ({
      id: r.id, tuteeId: r.tutee_id, modality: r.modality, date: dateOnly(r.assessment_date),
      time: r.assessment_time, status: r.status, results: r.results ?? undefined,
      learningNeeds: r.learning_needs ?? undefined, readingLevel: r.reading_level ?? undefined,
    }),
  },
  {
    stateKey: "bookings", table: "bookings", primaryKey: "id",
    orderBy: "created_at",
    toRow: (b) => ({
      id: b.id, tutee_id: b.tuteeId, program: b.program, subject: b.subject ?? "",
      grade_level: b.gradeLevel ?? "", modality: b.modality, learning_needs: b.learningNeeds ?? "",
      booking_type: b.bookingType, dates: jsonText(b.dates, []), class_time: b.time,
      session_type: b.sessionType ?? "one-on-one", cycle_type: b.cycleType ?? null,
      cycle_start: b.cycleStart ?? null, cycle_end: b.cycleEnd ?? null,
      cycle_session_allowance: b.cycleSessionAllowance ?? null,
      expires_at: b.expiresAt ? sqlDateTime(b.expiresAt) : null,
      expiration_warning_at: b.expirationWarningAt ? sqlDateTime(b.expirationWarningAt) : null,
      session_times: b.sessionTimes == null ? null : jsonText(b.sessionTimes, {}),
      session_subjects: b.sessionSubjects == null ? null : jsonText(b.sessionSubjects, {}),
      session_slots: b.sessionSlots == null ? null : jsonText(b.sessionSlots, []),
      schedule_proposal: b.scheduleProposal == null ? null : jsonText(b.scheduleProposal, {}),
      recurrence: b.recurrence == null ? null : jsonText(b.recurrence, {}),
      rate_per_hour: b.ratePerHour ?? 0, total_fee: b.totalFee ?? 0, status: b.status,
      tutor_id: b.tutorId ?? null, recommendations: jsonText(b.recommendations, []),
      created_at: sqlDateTime(b.createdAt), terminated_at: sqlDateTime(b.terminatedAt),
      termination_reason: b.terminationReason ?? null, cohort_id: b.cohortId ?? null,
      assessment_id: b.assessmentId ?? null, booking_status: b.bookingStatus ?? null,
      tutor_assignment_status: b.tutorAssignmentStatus ?? null, assignment_mode: b.assignmentMode ?? null,
      tutor_assignments: b.tutorAssignments == null ? null : jsonText(b.tutorAssignments, {}),
    }),
    fromRow: (r) => ({
      id: r.id, tuteeId: r.tutee_id, program: r.program, subject: r.subject,
      gradeLevel: r.grade_level, modality: r.modality, learningNeeds: r.learning_needs,
      bookingType: r.booking_type, dates: parseJson(r.dates, []), time: r.class_time,
      sessionType: r.session_type ?? "one-on-one", ...(r.cycle_type == null ? {} : { cycleType: r.cycle_type }),
      ...(r.cycle_start == null ? {} : { cycleStart: dateOnly(r.cycle_start) }),
      ...(r.cycle_end == null ? {} : { cycleEnd: dateOnly(r.cycle_end) }),
      ...(r.cycle_session_allowance == null ? {} : { cycleSessionAllowance: Number(r.cycle_session_allowance) }),
      ...(r.expires_at == null ? {} : { expiresAt: isoDateTime(r.expires_at) }),
      ...(r.expiration_warning_at == null ? {} : { expirationWarningAt: isoDateTime(r.expiration_warning_at) }),
      ...(r.session_times == null ? {} : { sessionTimes: parseJson(r.session_times, {}) }),
      ...(r.session_subjects == null ? {} : { sessionSubjects: parseJson(r.session_subjects, {}) }),
      ...(r.session_slots == null ? {} : { sessionSlots: parseJson(r.session_slots, []) }),
      ...(r.schedule_proposal == null ? {} : { scheduleProposal: parseJson(r.schedule_proposal, {}) }),
      ...(r.recurrence == null ? {} : { recurrence: parseJson(r.recurrence, {}) }),
      ratePerHour: Number(r.rate_per_hour), totalFee: Number(r.total_fee), status: r.status,
      tutorId: r.tutor_id, recommendations: parseJson(r.recommendations, []),
      createdAt: isoDateTime(r.created_at), ...(r.terminated_at ? { terminatedAt: isoDateTime(r.terminated_at) } : {}),
      ...(r.termination_reason == null ? {} : { terminationReason: r.termination_reason }),
      ...(r.cohort_id == null ? {} : { cohortId: r.cohort_id }),
      ...(r.assessment_id == null ? {} : { assessmentId: r.assessment_id }),
      ...(r.booking_status == null ? {} : { bookingStatus: r.booking_status }),
      ...(r.tutor_assignment_status == null ? {} : { tutorAssignmentStatus: r.tutor_assignment_status }),
      ...(r.assignment_mode == null ? {} : { assignmentMode: r.assignment_mode }),
      ...(r.tutor_assignments == null ? {} : { tutorAssignments: parseJson(r.tutor_assignments, {}) }),
    }),
  },
  {
    stateKey: "sessions", table: "sessions", primaryKey: "id",
    toRow: (s) => ({
      id: s.id, booking_id: s.bookingId, tutor_id: s.tutorId, tutee_id: s.tuteeId,
      assignment_id: s.assignmentId ?? s.id,
      session_date: s.date, session_time: s.time, modality: s.modality, status: s.status,
      tutee_checked_in_at: sqlDateTime(s.tuteeCheckedInAt),
      tutor_checked_in_at: sqlDateTime(s.tutorCheckedInAt), attended: s.attended ?? null,
      rating: s.rating ?? null, feedback: s.feedback ?? null,
    }),
    fromRow: (r) => ({
      id: r.id, bookingId: r.booking_id, tutorId: r.tutor_id, tuteeId: r.tutee_id,
      assignmentId: r.assignment_id ?? r.id,
      date: dateOnly(r.session_date), time: r.session_time, modality: r.modality, status: r.status,
      ...(r.tutee_checked_in_at ? { tuteeCheckedInAt: isoDateTime(r.tutee_checked_in_at) } : {}),
      ...(r.tutor_checked_in_at ? { tutorCheckedInAt: isoDateTime(r.tutor_checked_in_at) } : {}),
      attended: r.attended == null ? null : Boolean(r.attended),
      ...(r.rating == null ? {} : { rating: Number(r.rating) }),
      ...(r.feedback == null ? {} : { feedback: r.feedback }),
    }),
  },
  {
    stateKey: "progressReports", table: "progress_reports", primaryKey: "id",
    orderBy: "submitted_at DESC",
    toRow: (p) => ({
      id: p.id, session_id: p.sessionId, booking_id: p.bookingId, tutee_id: p.tuteeId,
      tutor_id: p.tutorId, session_date: p.sessionDate, subject: p.subject, skill: p.skill,
      learning_goal: p.learningGoal, progress_status: p.status, evidence: p.evidence,
      score: p.score ?? null, next_step: p.nextStep, submitted_at: sqlDateTime(p.submittedAt),
    }),
    fromRow: (r) => ({
      id: r.id, sessionId: r.session_id, bookingId: r.booking_id, tuteeId: r.tutee_id,
      tutorId: r.tutor_id, sessionDate: dateOnly(r.session_date), subject: r.subject,
      skill: r.skill, learningGoal: r.learning_goal, status: r.progress_status,
      evidence: r.evidence, score: r.score == null ? null : Number(r.score),
      nextStep: r.next_step, submittedAt: isoDateTime(r.submitted_at),
    }),
  },
  {
    stateKey: "messages", table: "messages", primaryKey: "id", orderBy: "sent_at",
    toRow: (m) => ({
      id: m.id, thread_id: m.threadId, from_id: m.fromId, message_text: m.text,
      sent_at: sqlDateTime(m.at), auto: Boolean(m.auto),
    }),
    fromRow: (r) => ({
      id: r.id, threadId: r.thread_id, fromId: r.from_id, text: r.message_text,
      at: isoDateTime(r.sent_at), auto: Boolean(r.auto),
    }),
  },
  {
    stateKey: "notifications", table: "notifications", primaryKey: "id", orderBy: "created_at DESC",
    toRow: (n) => ({
      id: n.id, user_id: n.userId, thread_id: n.threadId ?? null,
      notification_text: n.text, created_at: sqlDateTime(n.at),
      read_at: n.read ? sqlDateTime(n.readAt ?? n.at) : null,
      channels: jsonText(n.channels, []),
    }),
    fromRow: (r) => ({
      id: r.id, userId: r.user_id, threadId: r.thread_id,
      text: r.notification_text, at: isoDateTime(r.created_at), read: r.read_at != null,
      channels: parseJson(r.channels, []),
    }),
  },
  {
    stateKey: "purchases", table: "purchases", primaryKey: "id", orderBy: "purchased_at DESC",
    toRow: (p) => ({
      id: p.id, tutee_id: p.tuteeId, items: jsonText(p.items, []), total: p.total ?? 0,
      status: p.status, purchased_at: sqlDateTime(p.at),
    }),
    fromRow: (r) => ({
      id: r.id, tuteeId: r.tutee_id, items: parseJson(r.items, []),
      total: Number(r.total), status: r.status, at: isoDateTime(r.purchased_at),
    }),
  },
  {
    stateKey: "materials", table: "materials", primaryKey: "id", orderBy: "uploaded_at DESC",
    toRow: (m) => ({
      id: m.id, title: m.title, program: m.program, file_name: m.fileName,
      mime: m.mime, size: m.size ?? 0, data: m.data ?? "", note: m.note ?? "",
      uploaded_at: sqlDateTime(m.uploadedAt), allow_tutors: Boolean(m.allowTutors),
      allow_tutees: Boolean(m.allowTutees), allowed_user_ids: jsonText(m.allowedUserIds, []),
      revoked: Boolean(m.revoked),
    }),
    fromRow: (r) => ({
      id: r.id, title: r.title, program: r.program, fileName: r.file_name, mime: r.mime,
      size: Number(r.size), data: r.data, note: r.note, uploadedAt: isoDateTime(r.uploaded_at),
      allowTutors: Boolean(r.allow_tutors), allowTutees: Boolean(r.allow_tutees),
      allowedUserIds: parseJson(r.allowed_user_ids, []), revoked: Boolean(r.revoked),
    }),
  },
  {
    stateKey: "materialLogs", table: "material_logs", primaryKey: "id", orderBy: "accessed_at DESC",
    toRow: (l) => ({
      id: l.id, material_id: l.materialId, user_id: l.userId,
      accessed_at: sqlDateTime(l.at),
    }),
    fromRow: (r) => ({
      id: r.id, materialId: r.material_id, userId: r.user_id, at: isoDateTime(r.accessed_at),
    }),
  },
  {
    stateKey: "leaves", table: "leaves", primaryKey: "id", orderBy: "submitted_at",
    toRow: (l) => ({
      id: l.id, tutor_id: l.tutorId, start_date: l.startDate, end_date: l.endDate,
      reason: l.reason, status: l.status, submitted_at: sqlDateTime(l.submittedAt),
      affected_session_ids: jsonText(l.affectedSessionIds, []),
    }),
    fromRow: (r) => ({
      id: r.id, tutorId: r.tutor_id, startDate: dateOnly(r.start_date),
      endDate: dateOnly(r.end_date), reason: r.reason, status: r.status,
      submittedAt: isoDateTime(r.submitted_at),
      affectedSessionIds: parseJson(r.affected_session_ids, []),
    }),
  },
  {
    stateKey: "activities", table: "activities", primaryKey: "id", orderBy: "created_at DESC",
    toRow: (a) => ({
      id: a.id, user_id: a.userId, kind: a.kind, activity_text: a.text,
      created_at: sqlDateTime(a.at),
    }),
    fromRow: (r) => ({
      id: r.id, userId: r.user_id, kind: r.kind, text: r.activity_text,
      at: isoDateTime(r.created_at),
    }),
  },
  {
    stateKey: "hirings", table: "hirings", primaryKey: "id",
    toRow: (h) => ({ id: h.id, title: h.title, description: h.description, open: Boolean(h.open) }),
    fromRow: (r) => ({ id: r.id, title: r.title, description: r.description, open: Boolean(r.open) }),
  },
  {
    stateKey: "tutorSchedules", table: "tutor_schedules", primaryKey: "tutor_id",
    rows: (value) => Object.entries(value ?? {}).map(([tutorId, schedule]) => ({ tutorId, ...schedule })),
    toRow: (s) => ({
      tutor_id: s.tutorId, days: jsonText(s.days, {}), modalities: jsonText(s.modalities, []),
      updated_at: sqlDateTime(s.updatedAt),
    }),
    fromRow: (r) => ({
      tutorId: r.tutor_id, days: parseJson(r.days, {}),
      modalities: parseJson(r.modalities, []), updatedAt: isoDateTime(r.updated_at),
    }),
    assign: (state, entries) => {
      state.tutorSchedules = Object.fromEntries(entries.map((entry) => [
        entry.tutorId,
        { days: entry.days, modalities: entry.modalities, updatedAt: entry.updatedAt },
      ]));
    },
  },
];

function recordsFor(descriptor, state) {
  const value = state[descriptor.stateKey];
  return descriptor.rows ? descriptor.rows(value) : Array.isArray(value) ? value : [];
}

function idFor(descriptor, record) {
  return record[descriptor.rows ? "tutorId" : descriptor.stateKey === "tutees" || descriptor.stateKey === "tutors" ? "userId" : "id"];
}

function mergeRecords(descriptor, state, rows) {
  const records = new Map(recordsFor(descriptor, state).map((record) => [idFor(descriptor, record), record]));
  for (const row of rows) {
    const record = descriptor.fromRow(row);
    records.set(idFor(descriptor, record), record);
  }
  const entries = [...records.values()];
  if (descriptor.assign) descriptor.assign(state, entries);
  else state[descriptor.stateKey] = entries;
}

function comparable(record) {
  return JSON.stringify(record);
}

export async function loadRelationalState(connection, baseState) {
  const state = structuredClone(baseState);
  const persistedState = { ...baseState, tutorSchedules: {} };
  for (const descriptor of tables) {
    const ordering = descriptor.orderBy ? ` ORDER BY ${descriptor.orderBy}` : "";
    const [rows] = await connection.query(`SELECT * FROM ${descriptor.table}${ordering}`);
    const dbRecords = rows.map((row) => descriptor.fromRow(row));
    if (descriptor.assign) descriptor.assign(persistedState, dbRecords);
    else persistedState[descriptor.stateKey] = dbRecords;
    mergeRecords(descriptor, state, rows);
  }
  return { state, persistedState };
}

export async function persistRelationalState(connection, state, previousState) {
  const [userRows] = await connection.query("SELECT id, role FROM users");
  const rolesById = new Map(userRows.map((row) => [row.id, row.role]));

  for (const descriptor of tables) {
    const currentRecords = recordsFor(descriptor, state);
    const roleRequired = descriptor.stateKey === "tutees" ? "tutee"
      : descriptor.stateKey === "tutors" ? "tutor"
      : null;
    const previousRecords = previousState ? recordsFor(descriptor, previousState) : [];
    const previousById = new Map(previousRecords.map((record) => [idFor(descriptor, record), record]));
    for (const record of currentRecords) {
      const id = idFor(descriptor, record);
      if (roleRequired && rolesById.get(id) !== roleRequired) {
        throw new Error(`Cannot persist ${descriptor.stateKey} profile for missing or non-${roleRequired} account ${id}.`);
      }
      if (previousState && comparable(record) === comparable(previousById.get(id))) continue;
      const row = descriptor.toRow(record);
      const columns = Object.keys(row);
      const updates = columns.filter((column) => column !== descriptor.primaryKey);
      const sql = `INSERT INTO ${descriptor.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")}) ON DUPLICATE KEY UPDATE ${updates.map((column) => `${column} = VALUES(${column})`).join(", ")}`;
      await connection.execute(sql, Object.values(row));
    }
  }

  for (const descriptor of [...tables].reverse()) {
    if (!previousState) continue;
    const currentIds = new Set(recordsFor(descriptor, state).map((record) => idFor(descriptor, record)));
    for (const record of recordsFor(descriptor, previousState)) {
      const id = idFor(descriptor, record);
      if (!currentIds.has(id)) {
        await connection.execute(`DELETE FROM ${descriptor.table} WHERE ${descriptor.primaryKey} = ?`, [id]);
      }
    }
  }
}

export function hasLegacyRelationalData(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value.users) && value.users.length > 0) return true;
  return tables.some((descriptor) => {
    const records = descriptor.rows ? Object.keys(value[descriptor.stateKey] ?? {}) : value[descriptor.stateKey];
    return Array.isArray(records) ? records.length > 0 : records?.length > 0;
  });
}

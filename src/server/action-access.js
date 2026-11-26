import "server-only";

const ADMIN_ACTIONS = new Set([
  "notify", "completeAssessment", "scheduleAssessment", "renewReadingAssessment", "scheduleInterview", "evaluateApplicant", "verifyExistingTutor",
  "setTutorPay", "adminEditTutorAvailability", "setTutorWeeklySchedule", "decideLeave",
  "adminLeave", "proposeBookingSchedule", "confirmBooking", "confirmBookingSession", "confirmReadingAssignment", "rejectReadingAssignment", "rejectBooking", "terminateBooking",
  "reassignSession", "reassignPlaygroupSession", "proposeSessionReschedule", "cancelSession", "updateCohort",
  "addCohort", "deleteCohort", "removeFromCohort", "assignPlaygroupBooking", "assignPlaygroupWeekday", "approvePlaygroupBooking", "addMaterial", "updateMaterial", "deleteMaterial",
]);

const TUTEE_ACTIONS = new Set([
  "requestAssessment", "cancelAssessment", "cancelTutorialBooking", "bookPlaygroup", "cancelPlaygroupBooking", "submitTutorialBooking",
  "rateSession",
]);
const TUTOR_ACTIONS = new Set(["submitLeave", "checkInSession", "completeSession"]);
const SHARED_ACTIONS = new Set([
  "markNotificationsRead", "markBookingNotificationsRead", "markMessageNotificationsRead", "sendMessage", "logMaterialAccess",
  "saveTuteeProfile", "saveTutorProfile", "saveAdminProfile", "decideBookingScheduleProposal",
]);

function deny(message = "You are not allowed to perform this action.") {
  return { ok: false, error: message };
}

export function authorizeBusinessAction(state, user, action, args) {
  // Admins retain the existing ability to correct session records. Tutors may
  // only record attendance for their own scheduled sessions after they end.
  if (action === "completeSession" && user.role === "admin") return { ok: true, args };

  if (ADMIN_ACTIONS.has(action)) {
    if (user.role !== "admin") return deny();
    return { ok: true, args };
  }

  if (TUTEE_ACTIONS.has(action) && user.role !== "tutee") return deny();
  if (TUTOR_ACTIONS.has(action) && user.role !== "tutor") return deny();
  if (!TUTEE_ACTIONS.has(action) && !TUTOR_ACTIONS.has(action) && !SHARED_ACTIONS.has(action)) return deny();

  const safeArgs = [...args];
  if (action === "markNotificationsRead" || action === "markMessageNotificationsRead") {
    safeArgs[0] = user.id;
  }
  if (action === "markBookingNotificationsRead") {
    if (user.role !== "tutee" || !state.bookings.some((booking) => booking.id === safeArgs[0] && booking.tuteeId === user.id)) return deny();
    safeArgs[0] = state.bookings.find((booking) => booking.id === safeArgs[0]).id;
  }
  if (action === "sendMessage") {
    const [, , text] = safeArgs;
    safeArgs[0] = user.role === "admin" ? safeArgs[0] : user.id;
    safeArgs[1] = user.id;
    safeArgs[2] = text;
  }
  if (action === "saveTuteeProfile") {
    if (user.role !== "admin") {
      if (user.role !== "tutee") return deny();
      safeArgs[0] = user.id;
      const allowed = new Set(["fullName", "age", "birthday", "gradeLevel", "contact", "guardianName", "photo"]);
      safeArgs[1] = Object.fromEntries(Object.entries(safeArgs[1] || {}).filter(([key]) => allowed.has(key)));
    }
  }
  if (action === "saveTutorProfile") {
    if (user.role !== "admin") {
      if (user.role !== "tutor") return deny();
      safeArgs[0] = user.id;
      const allowed = new Set(["fullName", "photo", "age", "contact", "resumeName", "resumeData", "bio", "subjects", "gradeBands", "birthday"]);
      safeArgs[1] = Object.fromEntries(Object.entries(safeArgs[1] || {}).filter(([key]) => allowed.has(key)));
    }
  }
  if (action === "saveAdminProfile") {
    if (user.role !== "admin") return deny();
    safeArgs[0] = user.id;
    const allowed = new Set(["fullName", "photo", "age", "birthday", "contact"]);
    safeArgs[1] = Object.fromEntries(Object.entries(safeArgs[1] || {}).filter(([key]) => allowed.has(key)));
  }
  if (action === "bookPlaygroup" || action === "requestAssessment") safeArgs[0] = user.id;
  if (action === "submitTutorialBooking") safeArgs[0] = { ...(safeArgs[0] || {}), tuteeId: user.id };
  if (action === "submitLeave") safeArgs[0] = user.id;
  if (action === "checkInSession") {
    const session = state.sessions.find((entry) => entry.id === safeArgs[0]);
    if (!session || session.tutorId !== user.id) return deny();
    safeArgs[1] = user.id;
  }
  if (action === "completeSession") {
    const session = state.sessions.find((entry) => entry.id === safeArgs[0]);
    if (!session || session.tutorId !== user.id) return deny();
    if (session.status !== "scheduled") return deny("Only scheduled sessions can be marked complete or no-show.");
    if (typeof safeArgs[1] !== "boolean") return deny("Choose whether the student attended the session.");
    const [hour, minute] = String(session.time).split(":").map(Number);
    const end = new Date(`${session.date}T00:00:00`);
    end.setHours(hour, minute + (Number(session.durationMinutes) || 45), 0, 0);
    if (end > new Date()) return deny("You can record attendance after the session ends.");
    safeArgs[0] = session.id;
  }
  if (action === "rateSession") {
    const session = state.sessions.find((entry) => entry.id === safeArgs[0]);
    const bookingSessions = session && state.sessions.filter((entry) => entry.bookingId === session.bookingId && entry.status !== "cancelled");
    const finalSession = bookingSessions?.slice().sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0];
    if (!session || session.tuteeId !== user.id) return deny();
    if (session.status !== "completed" || !bookingSessions?.length || bookingSessions.some((entry) => entry.status !== "completed") || finalSession.id !== session.id) {
      return deny("You can rate your tutor after the final session is complete.");
    }
    if (!Number.isInteger(safeArgs[1]) || safeArgs[1] < 1 || safeArgs[1] > 5 || typeof safeArgs[2] !== "string" || safeArgs[2].length > 2000) {
      return deny("Choose a rating from 1 to 5 stars and keep feedback under 2,000 characters.");
    }
    if (session.rating != null) return deny("This tutor has already been rated for this booking.");
  }
  if (action === "cancelAssessment") {
    const assessment = state.assessments.find((entry) => entry.id === safeArgs[0]);
    if (!assessment || assessment.tuteeId !== user.id) return deny();
  }
  if (action === "cancelTutorialBooking") {
    const booking = state.bookings.find((entry) => entry.id === safeArgs[0]);
    if (!booking || booking.tuteeId !== user.id) return deny();
  }
  if (action === "cancelPlaygroupBooking") {
    const booking = state.bookings.find((entry) => entry.id === safeArgs[0]);
    if (user.role !== "tutee" || !booking || booking.program !== "playgroup" || booking.tuteeId !== user.id) return deny();
  }
  if (action === "decideBookingScheduleProposal") {
    const booking = state.bookings.find((entry) => entry.id === safeArgs[0]);
    if (user.role !== "tutee" || !booking || booking.tuteeId !== user.id) return deny();
  }
  if (action === "logMaterialAccess") {
    safeArgs[1] = user.id;
    const material = state.materials.find((entry) => entry.id === safeArgs[0]);
    if (!material || material.revoked || (Array.isArray(material.allowedUserIds) && material.allowedUserIds.length && !material.allowedUserIds.includes(user.id)) || !(user.role === "tutor" ? material.allowTutors : material.allowTutees)) return deny();
  }

  return { ok: true, args: safeArgs };
}


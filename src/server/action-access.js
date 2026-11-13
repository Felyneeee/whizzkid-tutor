import "server-only";

const ADMIN_ACTIONS = new Set([
  "notify", "completeAssessment", "scheduleAssessment", "scheduleInterview", "evaluateApplicant", "verifyExistingTutor",
  "setTutorPay", "approveAvailability", "adminEditTutorAvailability", "setTutorWeeklySchedule", "rejectAvailability", "decideLeave",
  "adminLeave", "proposeBookingSchedule", "confirmBooking", "confirmBookingSession", "confirmReadingAssignment", "rejectReadingAssignment", "rejectBooking", "terminateBooking",
  "completeSession", "reassignSession", "proposeSessionReschedule", "cancelSession", "updateCohort",
  "addCohort", "removeFromCohort", "assignPlaygroupBooking", "assignPlaygroupWeekday", "approvePlaygroupBooking", "updatePurchase", "addMaterial", "updateMaterial", "deleteMaterial",
]);

const TUTEE_ACTIONS = new Set([
  "requestAssessment", "cancelAssessment", "cancelTutorialBooking", "bookPlaygroup", "submitTutorialBooking", "placeOrder",
  "rateSession",
]);
const TUTOR_ACTIONS = new Set(["submitAvailability", "submitLeave", "submitProgressReport", "checkInSession"]);
const SHARED_ACTIONS = new Set([
  "markNotificationsRead", "markMessageNotificationsRead", "sendMessage", "logMaterialAccess",
  "saveTuteeProfile", "saveTutorProfile", "decideBookingScheduleProposal",
]);

function deny(message = "You are not allowed to perform this action.") {
  return { ok: false, error: message };
}

export function authorizeBusinessAction(state, user, action, args) {
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
      const allowed = new Set(["fullName", "age", "birthday", "gradeLevel", "contact", "guardianName"]);
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
  if (action === "bookPlaygroup" || action === "requestAssessment") safeArgs[0] = user.id;
  if (action === "submitTutorialBooking") safeArgs[0] = { ...(safeArgs[0] || {}), tuteeId: user.id };
  if (action === "placeOrder") safeArgs[0] = user.id;
  if (action === "placeOrder") {
    if (!Array.isArray(safeArgs[1]) || safeArgs[1].length < 1 || safeArgs[1].length > 20) return deny("Choose between 1 and 20 order items.");
    safeArgs[1] = safeArgs[1].map((item) => ({ sku: item?.sku, qty: item?.qty }));
  }
  if (action === "submitAvailability" || action === "submitLeave") safeArgs[0] = user.id;
  if (action === "submitProgressReport") safeArgs[2] = user.id;
  if (action === "checkInSession") {
    const session = state.sessions.find((entry) => entry.id === safeArgs[0]);
    if (!session || session.tutorId !== user.id) return deny();
    safeArgs[1] = user.id;
  }
  if (action === "rateSession") {
    const session = state.sessions.find((entry) => entry.id === safeArgs[0]);
    if (!session || session.tuteeId !== user.id) return deny();
  }
  if (action === "submitProgressReport") {
    const session = state.sessions.find((entry) => entry.id === safeArgs[0]);
    if (!session || session.tutorId !== user.id) return deny();
  }
  if (action === "cancelAssessment") {
    const assessment = state.assessments.find((entry) => entry.id === safeArgs[0]);
    if (!assessment || assessment.tuteeId !== user.id) return deny();
  }
  if (action === "cancelTutorialBooking") {
    const booking = state.bookings.find((entry) => entry.id === safeArgs[0]);
    if (!booking || booking.tuteeId !== user.id) return deny();
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


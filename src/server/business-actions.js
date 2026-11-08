import "server-only";
import { ADMIN_ID } from "@/lib/seed";
import { ageFromBirthday, firstName, nowISO, todayISO, uid, fmtDate, fmtTime, addDays, rangeDates } from "@/lib/dates";
import { cohortSessionDates, computeRate, matchTutors, onApprovedLeave, payrollFor, tutorBusy, tutorFreeOn, approvedSlot, slotOccupied } from "@/lib/logic";
import { HOURS, PLAYGROUP_MONTHLY_FEE, SHOP_ITEMS } from "@/lib/constants";

export function createBusinessActions({ get, mutate }) {
  const pushNotif = (d, userId, text, channels = ["web", "email"], threadId) => {
    d.notifications.unshift({ id: uid("n"), userId, threadId, text, at: nowISO(), read: false, channels });
  };
  const pushAdmins = (d, text, channels = ["web"], threadId) => d.users.filter((u) => u.role === "admin").forEach((a) => pushNotif(d, a.id, text, channels, threadId));
  const logAct = (d, userId, kind, text) => d.activities.unshift({ id: uid("a"), userId, kind, text, at: nowISO() });
  const adminIdOf = (d) => d.users.find((u) => u.role === "admin")?.id || ADMIN_ID;
  const nameOf = (d, id) => d.tutees.find((t) => t.userId === id)?.fullName || d.tutors.find((t) => t.userId === id)?.fullName ||
    (d.users.find((u) => u.id === id)?.role === "admin" || id === ADMIN_ID ? "Admin" : id);
  const firstNameOf = (d, id) => firstName(nameOf(d, id), "User");
  const actions = {
// ---------- Generic ----------
  notify(userId, text, channels = ["web", "email"]) {
      mutate((n) => pushNotif(n, userId, text, channels));
  },
  markNotificationsRead(userId) {
      mutate((n) => n.notifications.filter((x) => x.userId === userId).forEach((x) => (x.read = true)));
  },
  markMessageNotificationsRead(userId, threadId) {
      mutate((n) => n.notifications
          .filter((x) => x.userId === userId && x.text.startsWith("New message") && (x.threadId === threadId || !x.threadId))
          .forEach((x) => (x.read = true)));
  },
  sendMessage(threadId, fromId, text) {
      const messageText = text.trim();
      if (!messageText)
          return;
      mutate((n) => {
          n.messages ?? (n.messages = []);
          n.messages.push({ id: uid("m"), threadId, fromId, text: messageText, at: nowISO() });
          const sender = n.users.find((u) => u.id === fromId);
          const recipientId = sender?.role === "admin" ? threadId : adminIdOf(n);
          if (recipientId !== fromId && n.users.some((u) => u.id === recipientId)) {
              pushNotif(n, recipientId, `New message from ${firstNameOf(n, fromId)}`, ["web"], threadId);
          }
      });
  },
  saveTuteeProfile(userId, p) {
      mutate((n) => {
          const t = n.tutees.find((x) => x.userId === userId);
          if (!t)
              return;
          Object.assign(t, p);
          if (t.birthday)
              t.age = ageFromBirthday(t.birthday);
          t.complete = !!(t.fullName && t.birthday && t.gradeLevel && t.contact);
      });
  },
  saveTutorProfile(userId, p) {
      mutate((n) => {
          const t = n.tutors.find((x) => x.userId === userId);
          if (t)
              Object.assign(t, p);
      });
  },
  // ---------- Tutee flows ----------
  bookAssessment(tuteeId, modality, date, time) {
      const d = get();
      if (d.assessments.some((a) => a.tuteeId === tuteeId && a.status === "booked"))
          return { ok: false, error: "You already have an upcoming assessment. Cancel it first to rebook." };
      if (slotOccupied(d, date, time))
          return { ok: false, error: "That slot was just taken. Please pick another." };
      const id = uid("as");
      mutate((n) => {
          n.assessments.push({ id, tuteeId, modality, date, time, status: "booked" });
          pushNotif(n, tuteeId, `Assessment booked: ${fmtDate(date)} at ${fmtTime(time)} (${modality}).`, ["web", "email", "sms"]);
          pushAdmins(n, `Reading assessment booked by ${nameOf(n, tuteeId)} — ${fmtDate(date)} ${fmtTime(time)}`);
          logAct(n, tuteeId, "booking", `Booked initial reading assessment on ${fmtDate(date)} ${fmtTime(time)}`);
      });
      return { ok: true, id };
  },
  completeAssessment(id, v) {
      mutate((n) => {
          const a = n.assessments.find((x) => x.id === id);
          if (!a)
              return;
          a.status = "completed";
          a.results = v.results;
          a.learningNeeds = v.learningNeeds;
          a.readingLevel = v.readingLevel;
          pushNotif(n, a.tuteeId, "Your assessment results are in! You can now proceed to Reading Program booking & matching.", ["web", "email", "sms"]);
          logAct(n, a.tuteeId, "match", `Assessment completed — level: ${v.readingLevel}`);
      });
  },
  cancelAssessment(id) {
      mutate((n) => {
          const a = n.assessments.find((x) => x.id === id);
          if (a)
              a.status = "cancelled";
      });
  },
  bookPlaygroup(tuteeId, cohortId) {
      const d = get();
      const c = d.cohorts.find((x) => x.id === cohortId);
      if (!c)
          return { ok: false, error: "Class not found." };
      if (c.enrolled.includes(tuteeId))
          return { ok: false, error: "You are already enrolled in this class." };
      if (c.enrolled.length >= c.capacity)
          return { ok: false, error: "This class is full. Please choose another schedule." };
      const bookingId = uid("b");
      const tutee = d.tutees.find((t) => t.userId === tuteeId);
      mutate((n) => {
          const cc = n.cohorts.find((x) => x.id === cohortId);
          cc.enrolled.push(tuteeId);
          const dates = cohortSessionDates(cc);
          n.bookings.push({
              id: bookingId,
              tuteeId,
              program: "playgroup",
              subject: "Playgroup",
              gradeLevel: tutee?.gradeLevel || "Nursery",
              modality: c.modality ?? "face-to-face",
              learningNeeds: "",
              bookingType: "recurring",
              dates,
              time: cc.time,
              ratePerHour: PLAYGROUP_MONTHLY_FEE,
              totalFee: PLAYGROUP_MONTHLY_FEE,
              status: "confirmed",
              recommendations: [],
              createdAt: nowISO(),
              cohortId,
              tutorId: cc.tutorId,
          });
          pushNotif(n, tuteeId, `Playgroup slot reserved: ${cc.label}, starting ${fmtDate(cc.startDate)}.`, ["web", "email", "sms"]);
          pushAdmins(n, `${nameOf(n, tuteeId)} reserved a slot in ${cc.label} (${cc.enrolled.length}/${cc.capacity})`);
          logAct(n, tuteeId, "booking", `Reserved playgroup slot: ${cc.label}`);
      });
      return { ok: true, bookingId };
  },
  submitTutorialBooking(v) {
      const d = get();
      if (!v.dates.length || !v.time)
          return { ok: false, error: "Choose at least one date and time." };
      if (v.dates.some((date) => date < todayISO()))
          return { ok: false, error: "Past dates cannot be booked. Please choose a future date." };
      const occupied = v.dates.filter((date) => slotOccupied(d, date, v.time));
      if (occupied.length)
          return { ok: false, error: `That time is no longer open on: ${occupied.map(fmtDate).join(", ")}. Please choose another slot.` };
      const matches = matchTutors(d, {
          program: v.program,
          subject: v.subject,
          gradeLevel: v.gradeLevel,
          modality: v.modality,
          dates: v.dates,
          time: v.time,
      });
      const bookingId = uid("b");
      const rate = computeRate(v.program, v.gradeLevel, v.modality);
      mutate((n) => {
          const b = {
              id: bookingId,
              tuteeId: v.tuteeId,
              program: v.program,
              subject: v.program === "reading" ? "Reading" : v.subject,
              gradeLevel: v.gradeLevel,
              modality: v.modality,
              learningNeeds: v.learningNeeds,
              bookingType: v.bookingType,
              dates: v.dates,
              time: v.time,
              recurrence: v.recurrence,
              ratePerHour: rate,
              totalFee: rate * v.dates.length,
              status: "awaiting_admin",
              recommendations: matches.slice(0, 3).map((m) => m.tutor.userId),
              createdAt: nowISO(),
              assessmentId: v.assessmentId,
          };
          n.bookings.push(b);
          pushNotif(n, v.tuteeId, matches.length
              ? "Booking request submitted. Your open slot is reserved while our admin reviews the tutor recommendations."
              : "Booking request submitted. Your open slot is reserved while we wait for a matching tutor to become available.", ["web", "email"]);
          pushAdmins(n, `New booking request from ${nameOf(n, v.tuteeId)} — ${b.subject}, ${v.dates.length} session(s). ${matches.length ? "Review recommendations." : "No tutor matches yet; review when an eligible tutor's availability is approved."}`);
          logAct(n, v.tuteeId, "booking", `Requested ${b.subject} ${v.bookingType} booking (${v.dates.length} session/s)`);
      });
      return { ok: true, bookingId };
  },
  placeOrder(tuteeId, items) {
      if (!Array.isArray(items) || !items.length || items.some((item) => !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99 || !SHOP_ITEMS.some((product) => product.sku === item.sku)))
          return { ok: false, error: "Order items are invalid. Refresh the page and try again." };
      items = items.map((item) => {
          const product = SHOP_ITEMS.find((entry) => entry.sku === item.sku);
          return { sku: product.sku, name: product.name, qty: item.qty, price: product.price };
      });
      const total = items.reduce((a, i) => a + i.qty * i.price, 0);
      mutate((n) => {
          n.purchases.unshift({ id: uid("p"), tuteeId, items, total, status: "pending", at: nowISO() });
          pushAdmins(n, `New purchase order from ${nameOf(n, tuteeId)} — ₱${total.toLocaleString()}`);
          pushNotif(n, tuteeId, `Order placed (₱${total.toLocaleString()}). Please settle payment at the center.`);
      });
  },
  rateSession(sessionId, rating, feedback) {
      mutate((n) => {
          const se = n.sessions.find((x) => x.id === sessionId);
          if (!se)
              return;
          se.rating = rating;
          se.feedback = feedback;
          logAct(n, se.tutorId, "rating", `Received ${rating}★ from ${firstNameOf(n, se.tuteeId)} (${fmtDate(se.date)})`);
          logAct(n, se.tuteeId, "rating", `Rated session on ${fmtDate(se.date)} ${rating}★`);
          logAct(n, adminIdOf(n), "rating", `${nameOf(n, se.tuteeId)} rated ${nameOf(n, se.tutorId)} ${rating}★`);
      });
  },
  // ---------- Tutor ----------
  submitAvailability(tutorId, entries, modalities, note) {
      const d = get();
      const conflicts = [];
      entries.forEach((e) => {
          d.sessions
              .filter((s) => s.tutorId === tutorId && s.date === e.date && s.status === "scheduled" && !e.slots.includes(s.time))
              .forEach((s) => conflicts.push(`${fmtDate(s.date)} ${fmtTime(s.time)}`));
      });
      const batchId = uid("batch");
      mutate((n) => {
          entries.forEach((e) => {
              // replace earlier pending records for this date
              n.availability = n.availability.filter((a) => !(a.tutorId === tutorId && a.date === e.date && a.status === "pending"));
              n.availability.push({
                  id: uid("av"),
                  batchId,
                  tutorId,
                  date: e.date,
                  slots: e.slots,
                  modalities,
                  status: "pending",
                  submittedAt: nowISO(),
                  note: note + (conflicts.length ? ` [Conflicts with confirmed sessions: ${conflicts.join(", ")}]` : ""),
              });
          });
          pushAdmins(n, `${nameOf(n, tutorId)} submitted availability for ${entries.length} day(s)${conflicts.length ? " — conflicts with confirmed sessions!" : ""}`);
          pushNotif(n, tutorId, "Availability submitted. Status: Pending Approval. Pending slots cannot be booked.", ["web"]);
      });
      return { ok: true, conflicts };
  },
  submitLeave(tutorId, startDate, endDate, reason) {
      mutate((n) => {
          n.leaves.push({ id: uid("lv"), tutorId, startDate, endDate, reason, status: "pending", submittedAt: nowISO() });
          pushAdmins(n, `${nameOf(n, tutorId)} requested leave ${fmtDate(startDate)} – ${fmtDate(endDate)}`);
          pushNotif(n, tutorId, "Leave request submitted. Status: Pending Approval.", ["web"]);
      });
  },
  // ---------- Admin ----------
  scheduleInterview(tutorId, at, notes) {
      mutate((n) => {
          const t = n.tutors.find((x) => x.userId === tutorId);
          if (!t)
              return;
          t.status = "interview";
          t.interviewAt = at;
          t.interviewNotes = notes;
          pushNotif(n, tutorId, `Interview scheduled: ${new Date(at).toLocaleString()}. ${notes}`, ["web", "email", "sms"]);
      });
  },
  evaluateApplicant(tutorId, accept, reason) {
      mutate((n) => {
          const t = n.tutors.find((x) => x.userId === tutorId);
          if (!t)
              return;
          t.status = accept ? "active" : "rejected";
          t.rejectionReason = accept ? undefined : reason;
          pushNotif(n, tutorId, accept ? "Congratulations! Your application is approved. Your account is now a Tutor account." : `Your application was not approved. ${reason || ""}`, ["web", "email", "sms"]);
      });
  },
  verifyExistingTutor(tutorId, approve, reason) {
      mutate((n) => {
          const t = n.tutors.find((x) => x.userId === tutorId);
          if (!t)
              return;
          t.status = approve ? "active" : "rejected";
          t.rejectionReason = approve ? undefined : reason;
          pushNotif(n, tutorId, approve ? "Your tutor account is verified and active." : `Verification not approved: ${reason || "Please contact the admin."}`, ["web", "email"]);
      });
  },
  setTutorPay(tutorId, hourlyRate, fixedSalary) {
      mutate((n) => {
          const t = n.tutors.find((x) => x.userId === tutorId);
          if (t) {
              t.hourlyRate = hourlyRate;
              t.fixedSalary = fixedSalary;
          }
      });
  },
  approveAvailability(batchId) {
      mutate((n) => {
          const recs = n.availability.filter((a) => a.batchId === batchId && a.status === "pending");
          if (!recs.length)
              return;
          const tutorId = recs[0].tutorId;
          const flagged = [];
          recs.forEach((r) => {
              // supersede previously-approved record for the same day
              n.availability = n.availability.filter((a) => !(a.tutorId === r.tutorId && a.date === r.date && a.status === "approved" && a.id !== r.id));
              const rec = n.availability.find((a) => a.id === r.id);
              rec.status = "approved";
              // flag scheduled sessions that fall outside new slots
              n.sessions.forEach((s) => {
                  if (s.tutorId === r.tutorId && s.date === r.date && s.status === "scheduled" && (!rec.slots.includes(s.time) || !rec.modalities.includes(s.modality))) {
                      s.status = "needs_reassignment";
                      flagged.push(s.id);
                  }
              });
          });
          pushNotif(n, tutorId, "Your availability was approved. Approved slots are now bookable.", ["web", "email"]);
          if (flagged.length)
              pushAdmins(n, `${flagged.length} confirmed session(s) of ${nameOf(n, tutorId)} conflict with approved availability changes — reassign them.`);
      });
  },
  adminEditTutorAvailability(tutorId, date, slots, modalities) {
      const d = get();
      const tutor = d.tutors.find((x) => x.userId === tutorId);
      if (!tutor || tutor.status !== "active")
          return { ok: false, error: "Choose an active tutor." };
      if (!date || date < todayISO())
          return { ok: false, error: "Choose today or a future date." };
      if (slots.some((time) => !HOURS.includes(time)))
          return { ok: false, error: "The schedule contains an invalid time." };
      const uniqueSlots = [...new Set(slots)].sort();
      const uniqueModalities = [...new Set(modalities)];
      const conflicts = d.sessions
          .filter((session) => session.tutorId === tutorId && session.date === date && session.status === "scheduled" && (!uniqueSlots.includes(session.time) || !uniqueModalities.includes(session.modality)))
          .map((session) => session.id);
      mutate((n) => {
          n.availability.forEach((entry) => {
              if (entry.tutorId === tutorId && entry.date === date && (entry.status === "approved" || entry.status === "pending")) {
                  entry.status = "rejected";
                  entry.note = `${entry.note ? `${entry.note} ` : ""}Replaced by an admin schedule edit.`;
              }
          });
          n.availability.push({
              id: uid("av"),
              batchId: uid("batch"),
              tutorId,
              date,
              slots: uniqueSlots,
              modalities: uniqueModalities,
              status: "approved",
              submittedAt: nowISO(),
              note: "Updated directly by admin.",
          });
          conflicts.forEach((sessionId) => {
              const session = n.sessions.find((x) => x.id === sessionId);
              if (session) {
                  session.status = "needs_reassignment";
                  pushNotif(n, session.tuteeId, `Your session with ${firstNameOf(n, tutorId)} on ${fmtDate(session.date)} at ${fmtTime(session.time)} needs rescheduling because the tutor's availability changed. The admin will follow up.`, ["web", "email", "sms"]);
              }
          });
          pushNotif(n, tutorId, `The admin updated your availability for ${fmtDate(date)}.${conflicts.length ? ` ${conflicts.length} session(s) need reassignment because they no longer fit the edited schedule.` : ""}`, ["web", "email"]);
          if (conflicts.length)
              pushAdmins(n, `${conflicts.length} session(s) of ${nameOf(n, tutorId)} need reassignment after an admin schedule edit.`);
          logAct(n, adminIdOf(n), "availability", `Edited ${nameOf(n, tutorId)}'s availability for ${fmtDate(date)}`);
      });
      return { ok: true, conflicts };
  },
  setTutorWeeklySchedule(tutorId, days, modalities) {
      const d = get();
      const tutor = d.tutors.find((x) => x.userId === tutorId);
      if (!tutor || tutor.status !== "active") return { ok: false, error: "Choose an active tutor." };
      const allowedDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const workDays = Object.keys(days || {});
      if (workDays.length !== 5 || workDays.some((day) => !allowedDays.includes(day))) return { ok: false, error: "Set exactly five working days from Monday through Saturday." };
      if (Object.values(days).some((value) => value !== true)) return { ok: false, error: "Choose five working days; the remaining day is the day off." };
      const uniqueModalities = [...new Set(modalities || [])];
      if (!uniqueModalities.length || uniqueModalities.some((m) => !["online", "face-to-face"].includes(m))) return { ok: false, error: "Select at least one supported modality." };
      const conflicts = d.sessions.filter((session) => {
          if (session.tutorId !== tutorId || !["scheduled", "needs_reassignment"].includes(session.status)) return false;
          const day = new Date(`${session.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
          return !days[day] || !uniqueModalities.includes(session.modality);
      }).map((session) => session.id);
      mutate((n) => {
          n.tutorSchedules ??= {};
          n.tutorSchedules[tutorId] = { days: Object.fromEntries(Object.keys(days).map((day) => [day, true])), modalities: uniqueModalities, updatedAt: nowISO() };
          conflicts.forEach((id) => {
              const session = n.sessions.find((x) => x.id === id);
              if (session) {
                  session.status = "needs_reassignment";
                  pushNotif(n, session.tuteeId, `Your session on ${fmtDate(session.date)} at ${fmtTime(session.time)} needs rescheduling because the tutor's weekly rotation changed. The admin will follow up.`, ["web", "email", "sms"]);
              }
          });
          pushNotif(n, tutorId, `The admin updated your weekly schedule. Day off: ${allowedDays.find((day) => !days[day])}.${conflicts.length ? ` ${conflicts.length} session(s) need reassignment.` : ""}`, ["web", "email"]);
          if (conflicts.length) pushAdmins(n, `${conflicts.length} session(s) of ${nameOf(n, tutorId)} need reassignment after a weekly schedule change.`);
          logAct(n, adminIdOf(n), "availability", `Updated ${nameOf(n, tutorId)}'s weekly tutor schedule`);
      });
      return { ok: true, conflicts };
  },
  rejectAvailability(batchId, reason) {
      mutate((n) => {
          const recs = n.availability.filter((a) => a.batchId === batchId && a.status === "pending");
          recs.forEach((r) => {
              r.status = "rejected";
              r.note = (r.note || "") + ` Rejected: ${reason}`;
          });
          if (recs[0])
              pushNotif(n, recs[0].tutorId, `Availability rejected. ${reason} You may revise and resubmit.`, ["web", "email"]);
      });
  },
  decideLeave(leaveId, approve) {
      mutate((n) => {
          const l = n.leaves.find((x) => x.id === leaveId);
          if (!l)
              return;
          l.status = approve ? "approved" : "rejected";
          if (!approve) {
              pushNotif(n, l.tutorId, "Your leave request was not approved. Existing schedule remains unchanged.", ["web", "email"]);
              return;
          }
          const affected = n.sessions.filter((s) => s.tutorId === l.tutorId && s.status === "scheduled" && s.date >= l.startDate && s.date <= l.endDate);
          affected.forEach((s) => (s.status = "needs_reassignment"));
          l.affectedSessionIds = affected.map((s) => s.id);
          pushNotif(n, l.tutorId, "Your leave request was approved.", ["web", "email"]);
          if (affected.length)
              pushAdmins(n, `Approved leave of ${nameOf(n, l.tutorId)} affects ${affected.length} confirmed session(s). Arrange rescheduling or tutor reassignment.`);
      });
  },
  adminLeave(adminId, startDate, endDate, reason) {
      mutate((n) => {
          n.leaves.push({ id: uid("lv"), tutorId: adminId, startDate, endDate, reason, status: "approved", submittedAt: nowISO() });
      });
  },
  proposeBookingSchedule(bookingId, sessions) {
      const d = get();
      const booking = d.bookings.find((x) => x.id === bookingId);
      if (!booking || booking.status !== "awaiting_admin")
          return { ok: false, error: "This booking is no longer awaiting assignment." };
      if (!sessions.length)
          return { ok: false, error: "A booking must include at least one session." };
      const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.some((session) => !session.date || session.date < todayISO() || !HOURS.includes(session.time)))
          return { ok: false, error: "Choose a future date and a valid time for every session." };
      if (new Set(sorted.map((session) => session.date)).size !== sorted.length)
          return { ok: false, error: "Each session needs a different date. Use one date per session." };
      const occupied = sorted.find((session) => slotOccupied(d, session.date, session.time, bookingId));
      if (occupied)
          return { ok: false, error: `${fmtDate(occupied.date)} at ${fmtTime(occupied.time)} is already occupied.` };
      const current = booking.dates.map((date) => ({ date, time: booking.sessionTimes?.[date] ?? booking.time })).sort((a, b) => a.date.localeCompare(b.date));
      if (!booking.scheduleProposal && current.length === sorted.length && current.every((session, i) => session.date === sorted[i].date && session.time === sorted[i].time))
          return { ok: false, error: "The proposed schedule is the same as the current request." };
      mutate((n) => {
          const target = n.bookings.find((x) => x.id === bookingId);
          target.scheduleProposal = { sessions: sorted, proposedAt: nowISO() };
          pushNotif(n, target.tuteeId, "The admin proposed a schedule change for your booking. Review it in Pending Requests and approve or decline it.", ["web", "email"]);
          pushAdmins(n, `A schedule change for ${nameOf(n, target.tuteeId)}'s ${target.subject} booking is waiting for tutee approval.`);
          logAct(n, adminIdOf(n), "booking", `Proposed a schedule change for ${nameOf(n, target.tuteeId)}'s ${target.subject} booking`);
      });
      return { ok: true };
  },
  decideBookingScheduleProposal(bookingId, approve) {
      const d = get();
      const booking = d.bookings.find((x) => x.id === bookingId);
      const proposal = booking?.scheduleProposal;
      if (!booking || !proposal)
          return { ok: false, error: "There is no schedule change waiting for approval." };
      const sessionProposal = !!proposal.sessionId;
      const currentSession = sessionProposal ? d.sessions.find((x) => x.id === proposal.sessionId) : undefined;
      if (sessionProposal && (!currentSession || (currentSession.status !== "scheduled" && currentSession.status !== "needs_reassignment")))
          return { ok: false, error: "This session can no longer be rescheduled." };
      if (!sessionProposal && booking.status !== "awaiting_admin")
          return { ok: false, error: "This booking is no longer awaiting schedule approval." };
      if (approve && sessionProposal) {
          const proposed = proposal.sessions[0];
          const tutor = currentSession && d.tutors.find((x) => x.userId === currentSession.tutorId);
          if (!proposed || proposed.date < todayISO() || slotOccupied(d, proposed.date, proposed.time, bookingId, currentSession?.id))
              return { ok: false, error: "The proposed slot is no longer available. Ask the admin to edit the schedule again." };
          if (!tutor || tutor.status !== "active" || !approvedSlot(d, tutor.userId, proposed.date, proposed.time, currentSession.modality) || onApprovedLeave(d, tutor.userId, proposed.date) || tutorBusy(d, tutor.userId, proposed.date, proposed.time, bookingId))
              return { ok: false, error: "The tutor is no longer available at the proposed time. Ask the admin to edit the tutor schedule or propose another time." };
      }
      else if (approve && proposal.sessions.some((session) => session.date < todayISO() || slotOccupied(d, session.date, session.time, bookingId))) {
          return { ok: false, error: "A proposed slot is no longer available. Ask the admin to edit the schedule again." };
      }
      mutate((n) => {
          const target = n.bookings.find((x) => x.id === bookingId);
          const pendingProposal = target.scheduleProposal;
          const accepted = pendingProposal.sessions;
          target.scheduleProposal = undefined;
          if (pendingProposal.sessionId) {
              const session = n.sessions.find((x) => x.id === pendingProposal.sessionId);
              if (approve) {
                  const oldDate = session.date;
                  const proposed = accepted[0];
                  session.date = proposed.date;
                  session.time = proposed.time;
                  session.status = "scheduled";
                  target.dates = [...new Set([...target.dates.filter((date) => date !== oldDate), proposed.date])].sort();
                  const sessionTimes = { ...(target.sessionTimes ?? {}) };
                  delete sessionTimes[oldDate];
                  sessionTimes[proposed.date] = proposed.time;
                  target.sessionTimes = sessionTimes;
                  target.time = sessionTimes[target.dates[0]] ?? proposed.time;
                  target.recurrence = undefined;
                  pushNotif(n, target.tuteeId, `You approved the rescheduled session: ${fmtDate(proposed.date)} at ${fmtTime(proposed.time)}.`, ["web", "email", "sms"]);
                  pushNotif(n, session.tutorId, `Your session with ${firstNameOf(n, target.tuteeId)} was rescheduled to ${fmtDate(proposed.date)} at ${fmtTime(proposed.time)}.`, ["web", "email"]);
                  pushAdmins(n, `${nameOf(n, target.tuteeId)} approved a session reschedule for ${target.subject}.`);
                  logAct(n, target.tuteeId, "booking", `Approved a session reschedule for ${target.subject}`);
              }
              else {
                  pushNotif(n, target.tuteeId, "You declined the proposed session time. The session remains on its current schedule while the admin follows up.", ["web", "email"]);
                  pushAdmins(n, `${nameOf(n, target.tuteeId)} declined a session reschedule for ${target.subject}.`);
                  logAct(n, target.tuteeId, "booking", `Declined a session reschedule for ${target.subject}`);
              }
          }
          else if (approve) {
              target.dates = accepted.map((session) => session.date);
              target.sessionTimes = Object.fromEntries(accepted.map((session) => [session.date, session.time]));
              target.time = accepted[0].time;
              target.bookingType = accepted.length > 1 ? "recurring" : "one-time";
              target.recurrence = undefined;
              target.totalFee = target.ratePerHour * accepted.length;
              const matches = matchTutors(n, {
                  program: target.program,
                  subject: target.subject,
                  gradeLevel: target.gradeLevel,
                  modality: target.modality,
                  dates: target.dates,
                  time: target.time,
                  times: target.sessionTimes,
                  ignoreBookingId: target.id,
              });
              target.recommendations = matches.slice(0, 3).map((match) => match.tutor.userId);
              pushNotif(n, target.tuteeId, "You approved the updated schedule. The admin will now review tutor matches for those dates and times.", ["web", "email"]);
              pushAdmins(n, `${nameOf(n, target.tuteeId)} approved the updated schedule for ${target.subject}. Tutor matching is ready for review.`);
              logAct(n, target.tuteeId, "booking", `Approved the proposed schedule for ${target.subject}`);
          }
          else {
              pushNotif(n, target.tuteeId, "You declined the proposed schedule. Your original request remains in place while the admin follows up.", ["web", "email"]);
              pushAdmins(n, `${nameOf(n, target.tuteeId)} declined the proposed schedule for ${target.subject}. Follow up or submit another proposal.`);
              logAct(n, target.tuteeId, "booking", `Declined the proposed schedule for ${target.subject}`);
          }
      });
      return { ok: true };
  },
  confirmBooking(bookingId, tutorId, allowPartial = false) {
      const d = get();
      const b = d.bookings.find((x) => x.id === bookingId);
      if (!b)
          return { ok: false, error: "Booking not found." };
      if (b.scheduleProposal)
          return { ok: false, error: "Wait for the tutee to approve or decline the proposed schedule first." };
      const t = d.tutors.find((x) => x.userId === tutorId);
      if (!t)
          return { ok: false, error: "Tutor not found." };
      const p = {
          program: b.program,
          subject: b.subject,
          gradeLevel: b.gradeLevel,
          modality: b.modality,
          dates: b.dates,
          time: b.time,
          times: b.sessionTimes,
          ignoreBookingId: b.id,
      };
      const okDates = b.dates.filter((dt) => tutorFreeOn(d, t, p, dt));
      const missing = b.dates.filter((dt) => !okDates.includes(dt));
      if (!okDates.length)
          return { ok: false, error: "That tutor is no longer available for any requested date." };
      if (missing.length && !allowPartial)
          return { ok: false, error: `Tutor can't cover: ${missing.map(fmtDate).join(", ")}` };
      mutate((n) => {
          const bb = n.bookings.find((x) => x.id === bookingId);
          bb.status = "confirmed";
          bb.tutorId = tutorId;
          bb.dates = okDates;
          bb.totalFee = bb.ratePerHour * okDates.length;
          okDates.forEach((dt) => {
              const s = { id: uid("s"), bookingId: bb.id, tutorId, tuteeId: bb.tuteeId, date: dt, time: bb.sessionTimes?.[dt] ?? bb.time, modality: bb.modality, status: "scheduled" };
              n.sessions.push(s);
          });
          const tutorFullName = nameOf(n, tutorId);
          const tutorFirstName = firstName(tutorFullName, "Tutor");
          const tuteeFirstName = firstNameOf(n, bb.tuteeId);
          const scheduleText = okDates.map((date) => `${fmtDate(date)} at ${fmtTime(bb.sessionTimes?.[date] ?? bb.time)}`).join(", ");
          pushNotif(n, bb.tuteeId, `Booking confirmed! Tutor ${tutorFirstName} — ${bb.subject}: ${scheduleText}.${missing.length ? ` Dates removed (tutor unavailable): ${missing.map(fmtDate).join(", ")}.` : ""}`, ["web", "email", "sms"]);
          pushNotif(n, tutorId, `New assignment: ${tuteeFirstName} — ${bb.subject}: ${scheduleText} (${bb.modality}).`, ["web", "email"]);
          logAct(n, bb.tuteeId, "match", `Matched with ${tutorFirstName} for ${bb.subject}`);
          logAct(n, tutorId, "match", `Assigned to ${tuteeFirstName} for ${bb.subject}`);
          logAct(n, adminIdOf(n), "match", `Confirmed ${tutorFullName} ↔ ${nameOf(n, bb.tuteeId)} (${bb.subject})`);
      });
      return { ok: true, missing };
  },
  rejectBooking(bookingId, reason) {
      mutate((n) => {
          const b = n.bookings.find((x) => x.id === bookingId);
          if (!b)
              return;
          b.status = "rejected";
          b.scheduleProposal = undefined;
          b.terminationReason = reason;
          pushNotif(n, b.tuteeId, `We couldn't confirm your booking. ${reason} Please choose another schedule.`, ["web", "email", "sms"]);
      });
  },
  terminateBooking(bookingId, reason) {
      mutate((n) => {
          const b = n.bookings.find((x) => x.id === bookingId);
          if (!b)
              return;
          b.status = "terminated";
          b.scheduleProposal = undefined;
          b.terminatedAt = nowISO();
          b.terminationReason = reason;
          const today = todayISO();
          n.sessions.forEach((s) => {
              if (s.bookingId === bookingId && s.status !== "completed" && s.date >= today)
                  s.status = "cancelled";
          });
          if (b.cohortId) {
              const c = n.cohorts.find((x) => x.id === b.cohortId);
              if (c)
                  c.enrolled = c.enrolled.filter((x) => x !== b.tuteeId);
          }
          const txt = `Contract terminated: ${b.subject} (${reason || "completed"}).`;
          logAct(n, b.tuteeId, "termination", txt);
          if (b.tutorId) {
              logAct(n, b.tutorId, "termination", `${txt} Tutee: ${firstNameOf(n, b.tuteeId)}`);
              pushNotif(n, b.tutorId, `Contract with ${firstNameOf(n, b.tuteeId)} ended.`, ["web"]);
          }
          logAct(n, adminIdOf(n), "termination", `${txt} Tutee: ${nameOf(n, b.tuteeId)}`);
          pushNotif(n, b.tuteeId, txt, ["web", "email"]);
      });
  },
  completeSession(sessionId, attended) {
      mutate((n) => {
          const s = n.sessions.find((x) => x.id === sessionId);
          if (!s)
              return;
          s.status = "completed";
          s.attended = attended;
          const open = n.sessions.some((x) => x.bookingId === s.bookingId && x.status !== "completed" && x.status !== "cancelled");
          if (!open) {
              const b = n.bookings.find((x) => x.id === s.bookingId);
              if (b && b.status === "confirmed")
                  b.status = "completed";
          }
          const booking = n.bookings.find((x) => x.id === s.bookingId);
          if (booking?.scheduleProposal?.sessionId === s.id) {
              booking.scheduleProposal = undefined;
              pushNotif(n, s.tuteeId, "The pending schedule proposal was withdrawn because the session was completed.", ["web"]);
          }
          if (attended)
              pushNotif(n, s.tuteeId, `Session on ${fmtDate(s.date)} marked completed. Please rate your tutor!`, ["web"]);
      });
  },
  submitProgressReport(sessionId, report, tutorId) {
      const d = get();
      const session = d.sessions.find((x) => x.id === sessionId);
      const tutor = d.users.find((x) => x.id === tutorId && x.role === "tutor");
      if (!tutor || !session || session.tutorId !== tutorId)
          return { ok: false, error: "You can only report progress for your assigned students." };
      if (session.status !== "completed" || session.attended === false)
          return { ok: false, error: "Progress can be reported only for a completed session that was not marked absent." };
      if (!report.subject.trim() || !report.skill.trim() || !report.learningGoal.trim() || !report.evidence.trim() || !report.nextStep.trim())
          return { ok: false, error: "Complete the subject, skill, goal, evidence, and next step." };
      if (report.score !== null && (!Number.isFinite(report.score) || report.score < 0 || report.score > 100))
          return { ok: false, error: "Mastery check score must be between 0 and 100." };
      const existing = d.progressReports.find((x) => x.sessionId === sessionId);
      const reportId = existing?.id ?? uid("progress");
      mutate((n) => {
          const target = {
              id: reportId,
              sessionId,
              bookingId: session.bookingId,
              tuteeId: session.tuteeId,
              tutorId: session.tutorId,
              sessionDate: session.date,
              subject: report.subject.trim(),
              skill: report.skill.trim(),
              learningGoal: report.learningGoal.trim(),
              status: report.status,
              evidence: report.evidence.trim(),
              score: report.score,
              nextStep: report.nextStep.trim(),
              submittedAt: nowISO(),
          };
          if (existing)
              n.progressReports = n.progressReports.map((x) => x.id === reportId ? target : x);
          else
              n.progressReports.unshift(target);
          pushNotif(n, session.tuteeId, `Your tutor updated your ${target.subject} learning progress.`, ["web"]);
      });
      return { ok: true, reportId };
  },
  checkInSession(sessionId, tutorId) {
      const d = get();
      const session = d.sessions.find((x) => x.id === sessionId);
      if (!session || session.tutorId !== tutorId)
          return { ok: false, error: "Session not found." };
      if (session.date !== todayISO())
          return { ok: false, error: "You can check in on the day of your session." };
      if (session.status !== "scheduled")
          return { ok: false, error: "This session is not currently scheduled." };
      if (session.tutorCheckedInAt)
          return { ok: false, error: "You are already checked in for this session." };
      const checkedInAt = nowISO();
      mutate((n) => {
          const target = n.sessions.find((x) => x.id === sessionId);
          target.tuteeCheckedInAt = checkedInAt;
          target.tutorCheckedInAt = checkedInAt;
          target.attended = true;
          pushNotif(n, target.tuteeId, `${firstNameOf(n, target.tutorId)} checked you in for today's session at ${fmtTime(target.time)}.`, ["web"]);
          pushAdmins(n, `${firstNameOf(n, target.tutorId)} checked in at ${fmtTime(target.time)} and marked ${firstNameOf(n, target.tuteeId)} present.`);
          logAct(n, tutorId, "attendance", `Checked in for session with ${firstNameOf(n, target.tuteeId)} at ${fmtTime(target.time)}`);
      });
      return { ok: true, checkedInAt };
  },
  reassignSession(sessionId, tutorId) {
      const d = get();
      const s = d.sessions.find((x) => x.id === sessionId);
      if (!s)
          return { ok: false, error: "Session not found." };
      const t = d.tutors.find((x) => x.userId === tutorId);
      if (!t || t.status !== "active")
          return { ok: false, error: "Tutor not active." };
      if (!approvedSlot(d, tutorId, s.date, s.time, s.modality) || onApprovedLeave(d, tutorId, s.date) || tutorBusy(d, tutorId, s.date, s.time, undefined))
          return { ok: false, error: "That tutor is not free for this slot (approved availability, leave and existing sessions are checked)." };
      mutate((n) => {
          const ss = n.sessions.find((x) => x.id === sessionId);
          const old = ss.tutorId;
          ss.tutorId = tutorId;
          ss.status = "scheduled";
          const b = n.bookings.find((x) => x.id === ss.bookingId);
          if (b && b.tutorId === old)
              b.tutorId = tutorId;
          pushNotif(n, ss.tuteeId, `Your session on ${fmtDate(ss.date)} now has a new tutor: ${firstNameOf(n, tutorId)}.`, ["web", "email", "sms"]);
          pushNotif(n, tutorId, `You were assigned a session on ${fmtDate(ss.date)} at ${fmtTime(ss.time)}.`, ["web", "email"]);
          pushNotif(n, old, `Your session on ${fmtDate(ss.date)} was reassigned.`, ["web"]);
      });
      return { ok: true };
  },
  proposeSessionReschedule(sessionId, date, time) {
      const d = get();
      const session = d.sessions.find((x) => x.id === sessionId);
      if (!session || (session.status !== "scheduled" && session.status !== "needs_reassignment"))
          return { ok: false, error: "Only an upcoming session can be rescheduled." };
      if (session.date < todayISO())
          return { ok: false, error: "Past sessions cannot be rescheduled." };
      if (!date || date < todayISO() || !HOURS.includes(time))
          return { ok: false, error: "Choose today or a future date and a valid time." };
      if (session.date === date && session.time === time)
          return { ok: false, error: "Choose a different date or time." };
      const booking = d.bookings.find((x) => x.id === session.bookingId);
      if (!booking || booking.status !== "confirmed")
          return { ok: false, error: "Only a confirmed class session can be rescheduled." };
      if (booking.scheduleProposal && booking.scheduleProposal.sessionId !== sessionId)
          return { ok: false, error: "Another schedule change is already waiting for tutee approval." };
      if (date !== session.date && booking.dates.includes(date))
          return { ok: false, error: "This booking already has a session on that date." };
      if (slotOccupied(d, date, time, session.bookingId, session.id))
          return { ok: false, error: "That date and time is already occupied." };
      mutate((n) => {
          const target = n.bookings.find((x) => x.id === session.bookingId);
          target.scheduleProposal = { sessionId, sessions: [{ date, time }], proposedAt: nowISO() };
          pushNotif(n, target.tuteeId, `The admin proposed moving your session to ${fmtDate(date)} at ${fmtTime(time)}. Approve or decline it in Pending Requests.`, ["web", "email"]);
          pushAdmins(n, `A session reschedule for ${nameOf(n, target.tuteeId)} is waiting for tutee approval.`);
          logAct(n, adminIdOf(n), "booking", `Proposed rescheduling a session for ${nameOf(n, target.tuteeId)} to ${fmtDate(date)} ${fmtTime(time)}`);
      });
      return { ok: true };
  },
  cancelSession(sessionId) {
      mutate((n) => {
          const s = n.sessions.find((x) => x.id === sessionId);
          if (!s)
              return;
          s.status = "cancelled";
          const booking = n.bookings.find((x) => x.id === s.bookingId);
          if (booking?.scheduleProposal?.sessionId === s.id)
              booking.scheduleProposal = undefined;
          pushNotif(n, s.tuteeId, `Your session on ${fmtDate(s.date)} was cancelled. We'll contact you about rescheduling.`, ["web", "email", "sms"]);
      });
  },
  updateCohort(id, p) {
      mutate((n) => {
          const c = n.cohorts.find((x) => x.id === id);
          if (c)
              Object.assign(c, p);
      });
  },
  addCohort(c) {
      mutate((n) => {
          n.cohorts.push({ ...c, modality: "face-to-face", id: uid("pg"), enrolled: [] });
      });
  },
  removeFromCohort(cohortId, tuteeId) {
      mutate((n) => {
          const c = n.cohorts.find((x) => x.id === cohortId);
          if (c)
              c.enrolled = c.enrolled.filter((x) => x !== tuteeId);
          n.bookings.forEach((b) => {
              if (b.cohortId === cohortId && b.tuteeId === tuteeId)
                  b.status = "terminated";
          });
      });
  },
  updatePurchase(id, status) {
      if (!["paid", "released"].includes(status))
          return { ok: false, error: "Choose a valid order status." };
      const purchase = get().purchases.find((x) => x.id === id);
      if (!purchase)
          return { ok: false, error: "Order not found." };
      if ((status === "paid" && purchase.status !== "pending") || (status === "released" && purchase.status !== "paid"))
          return { ok: false, error: "Orders must be paid before release." };
      mutate((n) => {
          const p = n.purchases.find((x) => x.id === id);
          p.status = status;
          pushNotif(n, p.tuteeId, `Your order is now marked "${status}".`, ["web", "email"]);
      });
      return { ok: true };
  },
  addMaterial(m) {
      mutate((n) => {
          n.materials.unshift({ ...m, id: uid("mat"), uploadedAt: nowISO(), revoked: false });
          logAct(n, adminIdOf(n), "upload", `Uploaded learning material: ${m.title}`);
          if (m.allowTutees)
              n.tutees.forEach((t) => pushNotif(n, t.userId, `New learning material available: ${m.title}`, ["web"]));
          if (m.allowTutors)
              n.tutors.filter((t) => t.status === "active").forEach((t) => pushNotif(n, t.userId, `New learning material available: ${m.title}`, ["web"]));
      });
  },
  updateMaterial(id, p) {
      mutate((n) => {
          const m = n.materials.find((x) => x.id === id);
          if (m)
              Object.assign(m, p);
      });
  },
  deleteMaterial(id) {
      mutate((n) => {
          n.materials = n.materials.filter((m) => m.id !== id);
      });
  },
  logMaterialAccess(materialId, userId) {
      mutate((n) => {
          n.materialLogs.unshift({ id: uid("ml"), materialId, userId, at: nowISO() });
          const m = n.materials.find((x) => x.id === materialId);
          if (m)
              logAct(n, userId, "upload", `Viewed material: ${m.title}`);
      });
  },
  generatePayroll(period) {
      mutate((n) => {
          n.tutors
              .filter((t) => t.status === "active")
              .forEach((t) => {
              const p = payrollFor(n, t.userId, period);
              if (!p)
                  return;
              const existing = n.payroll.find((r) => r.tutorId === t.userId && r.period === period);
              if (existing) {
                  if (!existing.paid)
                      Object.assign(existing, { hours: p.hours, hourlyRate: p.hourlyRate, fixedSalary: p.fixedSalary, amount: p.amount });
              }
              else {
                  n.payroll.push({ id: uid("pr"), ...p, paid: false });
              }
          });
      });
  },
  markPayrollPaid(id) {
      mutate((n) => {
          const r = n.payroll.find((x) => x.id === id);
          if (!r)
              return;
          r.paid = true;
          r.paidAt = nowISO();
          pushNotif(n, r.tutorId, `Payroll for ${r.period} (₱${r.amount.toLocaleString()}) has been released.`, ["web", "email", "sms"]);
      });
  },

  };
  return actions;
}

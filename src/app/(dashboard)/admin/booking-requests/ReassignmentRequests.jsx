"use client";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Empty, FilterPopover, FilterTrigger } from "@/components/ui";
import { fmtDate, fmtTime, todayISO, weekday } from "@/lib/dates";
import { matchTutors, onApprovedLeave, tutorBusy, tutorWorksPlaygroupDate } from "@/lib/logic";
import { useStore } from "@/lib/store";

function CompatibilityBreakdown({ match }) {
  if (match.subjectScore === undefined) return null;
  const metrics = [["Subject Expertise", match.subjectScore, 35], ["Availability", match.scheduleScore, 25], ["Grade Level", match.gradeScore, 25], ["Workload", match.workloadScore, 15], ["Matching Score", match.score, 100]];
  return <details className="mt-2 pl-2 text-xs"><summary className="cursor-pointer font-bold">Compatibility Breakdown</summary><div className="mt-2 space-y-2">{metrics.map(([label, value, max]) => <div key={label} className="grid items-center gap-2 sm:grid-cols-[8rem_minmax(5rem,1fr)_7rem]"><span>{label}</span><div className="h-2 overflow-hidden rounded-full bg-slate-200"><div className={`h-full rounded-full ${label === "Matching Score" ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }}/></div><span>{Number(value).toFixed(value % 1 ? 1 : 0)}% / {max}%</span></div>)}</div></details>;
}

export default function ReassignmentRequests() {
  const s = useStore();
  const [sortOrder, setSortOrder] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedTutee, setExpandedTutee] = useState(null);
  const [openMatches, setOpenMatches] = useState({});
  const [choices, setChoices] = useState({});
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState({});
  const [message, setMessage] = useState("");

  const queue = useMemo(() => {
    const proposals = [];
    const proposedSessionIds = new Set();
    for (const booking of s.db.bookings) {
      if (!booking.rescheduleProposal) continue;
      const proposal = booking.rescheduleProposal;
      for (const item of proposal.sessions || [proposal]) {
        const session = s.db.sessions.find((entry) => entry.id === item.sessionId && entry.bookingId === booking.id);
        if (!session || session.status === "cancelled") continue;
        proposedSessionIds.add(session.id);
        proposals.push({ key: `proposal:${booking.id}:${session.id}`, kind: "rescheduled", booking, session, item, proposal, sortAt: proposal.requestedAt || booking.createdAt || "" });
      }
    }
    const playgroupStatuses = new Set(["approved", "confirmed", "to_pay", "awaiting_payment_approval"]);
    for (const booking of s.db.bookings) {
      if (booking.program !== "playgroup" || !playgroupStatuses.has(booking.status)) continue;
      const cohort = s.db.cohorts.find((entry) => entry.id === booking.cohortId);
      for (const date of Object.keys(booking.reassignmentPendingDates || {})) {
        if (date < todayISO()) continue;
        const oldTutorId = booking.tutorAssignments?.[date] || cohort?.weekdayTutorIds?.[weekday(date)] || booking.tutorId;
        proposals.push({
          key: `playgroup:${booking.id}:${date}`,
          kind: "playgroup",
          booking,
          session: { id: `playgroup:${booking.id}:${date}`, bookingId: booking.id, tuteeId: booking.tuteeId, date, time: booking.time || cohort?.time || "10:00", modality: cohort?.modality || "face-to-face" },
          item: { sessionId: `playgroup:${booking.id}:${date}`, original: { date, time: booking.time || cohort?.time || "10:00", tutorId: oldTutorId }, date, time: booking.time || cohort?.time || "10:00" },
          sortAt: booking.reassignmentPendingDates[date],
        });
      }
    }
    const reassigned = s.db.sessions.filter((session) => session.status === "needs_reassignment" && session.date >= todayISO() && !proposedSessionIds.has(session.id)).map((session) => ({
      key: `reassignment:${session.id}`,
      kind: "reassigned",
      session,
      booking: s.db.bookings.find((booking) => booking.id === session.bookingId),
      item: { sessionId: session.id, original: { date: session.date, time: session.time, tutorId: session.tutorId }, date: session.date, time: session.time },
      sortAt: session.reassignmentRequestedAt || session.date,
    }));
    const groups = new Map();
    for (const entry of [...proposals, ...reassigned]) {
      const tuteeId = entry.booking?.tuteeId || entry.session.tuteeId;
      const group = groups.get(tuteeId) || { tuteeId, entries: [], sortAt: "" };
      group.entries.push(entry);
      if (String(entry.sortAt) > String(group.sortAt)) group.sortAt = entry.sortAt;
      groups.set(tuteeId, group);
    }
    return [...groups.values()].map((group) => ({
      ...group,
      entries: group.entries.sort((a, b) => String(a.item.date).localeCompare(String(b.item.date)) || String(a.item.time).localeCompare(String(b.item.time))),
      name: s.db.tutees.find((entry) => entry.userId === group.tuteeId)?.fullName || group.tuteeId,
    })).sort((a, b) => {
      const byDate = String(a.sortAt).localeCompare(String(b.sortAt));
      return (sortOrder === "newest" ? -byDate : byDate) || a.name.localeCompare(b.name);
    });
  }, [s.db.bookings, s.db.sessions, s.db.tutees, sortOrder]);

  const matchingFor = (entry) => {
    const booking = entry.booking || {};
    const item = entry.item;
    if (entry.kind === "playgroup") {
      const cohortId = booking.cohortId;
      const time = item.time;
      return s.db.tutors.filter((tutor) => {
        if (tutor.status !== "active" || tutor.userId === item.original.tutorId || !tutorWorksPlaygroupDate(s.db, tutor.userId, item.date) || onApprovedLeave(s.db, tutor.userId, item.date) || tutorBusy(s.db, tutor.userId, item.date, time, booking.id)) return false;
        return !s.db.bookings.some((other) => {
          if (other.id === booking.id || other.program !== "playgroup" || other.cohortId === cohortId || !["approved", "confirmed", "to_pay", "awaiting_payment_approval"].includes(other.status) || !(other.dates || []).includes(item.date)) return false;
          const otherCohort = s.db.cohorts.find((entry) => entry.id === other.cohortId);
          return (other.tutorAssignments?.[item.date] || otherCohort?.weekdayTutorIds?.[weekday(item.date)] || other.tutorId) === tutor.userId;
        });
      }).map((tutor) => {
        const workload = s.db.bookings.reduce((total, other) => {
          if (other.program !== "playgroup" || !["approved", "confirmed", "to_pay", "awaiting_payment_approval"].includes(other.status)) return total;
          const otherCohort = s.db.cohorts.find((entry) => entry.id === other.cohortId);
          return total + (other.dates || []).filter((date) => weekday(date) === weekday(item.date) && date >= todayISO() && (other.tutorAssignments?.[date] || otherCohort?.weekdayTutorIds?.[weekday(date)] || other.tutorId) === tutor.userId).length;
        }, 0);
        return { tutor, coverage: 1, total: 1, score: 100 / (1 + workload / 4), workload };
      }).sort((a, b) => b.score - a.score);
    }
    const subject = booking.sessionSlots?.find((slot) => slot.date === item.original.date && slot.time === item.original.time)?.subject
      || booking.sessionSubjects?.[item.original.date]
      || booking.subject
      || "";
    return matchTutors(s.db, {
      program: booking.program || "academic",
      subject,
      gradeLevel: booking.gradeLevel,
      modality: entry.session.modality || booking.modality,
      learningNeeds: booking.learningNeeds,
      sessionType: booking.sessionType || "one-on-one",
      dates: [item.date],
      times: { [item.date]: item.time },
      time: item.time,
      ignoreBookingId: booking.id,
    }).filter((match) => match.full && (entry.kind !== "reassigned" || match.tutor.userId !== item.original.tutorId));
  };

  const assign = async (entry, tutorId) => {
    setBusy((current) => ({ ...current, [entry.key]: true }));
    setErrors((current) => ({ ...current, [entry.key]: "" }));
    const result = entry.kind === "playgroup"
      ? await s.reassignPlaygroupSession(entry.booking.id, entry.session.date, tutorId)
      : await s.reassignSession(entry.session.id, tutorId);
    setBusy((current) => ({ ...current, [entry.key]: false }));
    if (!result.ok) setErrors((current) => ({ ...current, [entry.key]: result.error || "Could not reassign this session." }));
    else setMessage("Tutor reassigned. The tutee and tutors were notified, and their calendars are updated.");
  };

  const approveReschedule = async (bookingId, entries) => {
    const selected = Object.fromEntries(entries.map((entry) => [entry.session.id, choices[entry.key] || ""]));
    if (Object.values(selected).some((tutorId) => !tutorId)) return;
    const booking = entries[0].booking;
    setBusy((current) => ({ ...current, [bookingId]: true }));
    setErrors((current) => ({ ...current, [bookingId]: "" }));
    try {
      const response = await fetch("/api/state/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "reviewBookingReschedule", args: [bookingId, true, selected] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrors((current) => ({ ...current, [bookingId]: payload.error || "Could not approve this reschedule." }));
        setBusy((current) => ({ ...current, [bookingId]: false }));
      } else {
        window.location.reload();
      }
    } catch {
      setErrors((current) => ({ ...current, [bookingId]: "Could not reach the server. Try again." }));
      setBusy((current) => ({ ...current, [bookingId]: false }));
    }
  };

  const rejectReschedule = async (bookingId) => {
    setBusy((current) => ({ ...current, [bookingId]: true }));
    try {
      const response = await fetch("/api/state/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action: "reviewBookingReschedule", args: [bookingId, false, {}] }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setErrors((current) => ({ ...current, [bookingId]: payload.error || "Could not reject this reschedule." }));
        setBusy((current) => ({ ...current, [bookingId]: false }));
      } else window.location.reload();
    } catch {
      setErrors((current) => ({ ...current, [bookingId]: "Could not reach the server. Try again." }));
      setBusy((current) => ({ ...current, [bookingId]: false }));
    }
  };

  return <div className="space-y-4">
    <div className="relative flex justify-end"><FilterTrigger onClick={() => setFiltersOpen((open) => !open)} ariaLabel="Sort reassignment requests" expanded={filtersOpen} count={sortOrder !== "newest" ? 1 : 0}/>{filtersOpen && <FilterPopover onClear={() => setSortOrder("newest")} onCancel={() => setFiltersOpen(false)} onApply={() => setFiltersOpen(false)}><fieldset><legend className="mb-2 text-xs font-extrabold text-slate-700">Sort by</legend><div className="space-y-1">{[["newest", "Newest first"], ["oldest", "Oldest first"]].map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-brand-50"><input type="radio" name="reassignment-sort" checked={sortOrder === value} onChange={() => setSortOrder(value)} className="accent-brand-600"/>{label}</label>)}</div></fieldset></FilterPopover>}</div>
    {message && <Alert kind="success">{message}</Alert>}
    {queue.length === 0 ? <Empty>No reschedules or tutor reassignments need review.</Empty> : <div className="space-y-3">{queue.map((group) => {
      const expanded = expandedTutee === group.tuteeId;
      const proposals = new Map();
      group.entries.filter((entry) => entry.kind === "rescheduled").forEach((entry) => {
        const proposalEntries = proposals.get(entry.booking.id) || [];
        proposalEntries.push(entry);
        proposals.set(entry.booking.id, proposalEntries);
      });
      const reassignedEntries = group.entries.filter((entry) => entry.kind !== "rescheduled");
      return <Card key={group.tuteeId} className="!p-0">
        <button type="button" className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left" onClick={() => setExpandedTutee(expanded ? null : group.tuteeId)} aria-expanded={expanded}>
          <span><span className="block font-extrabold">{group.name}</span><span className="text-sm text-slate-500">{group.entries.length} session(s) · {group.entries.some((entry) => entry.kind === "rescheduled") ? "Reschedule" : "Reassignment"}{group.entries.some((entry) => entry.kind === "rescheduled") && group.entries.some((entry) => entry.kind !== "rescheduled") ? " + Reassignment" : ""}</span><span className="block text-xs text-slate-400">{group.entries.map((entry) => `${fmtDate(entry.item.date)} · ${fmtTime(entry.item.time)}`).join("  /  ")}</span></span>
          <span className="flex items-center gap-2"><Badge status="pending">{group.entries.length} pending</Badge><span className="text-sm font-bold text-brand-600">{expanded ? "Hide matching" : "Assign a tutor"}</span></span>
        </button>
        {expanded && <div className="space-y-4 border-t border-slate-100 p-4">
          {[...proposals.entries()].map(([bookingId, entries]) => <section key={bookingId} className="space-y-3 rounded-xl border border-slate-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-extrabold">{entries[0].booking.program === "reading" ? "Reading" : entries[0].booking.subject || "Session"} · Rescheduled</h3><Badge status="pending">Awaiting admin approval</Badge></div>
            {entries.map((entry) => {
              const options = matchingFor(entry);
              const selectedId = choices[entry.key] || "";
              const open = openMatches[entry.key];
              return <div key={entry.key} className="rounded-lg bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><div>{fmtDate(entry.item.original.date)} · {fmtTime(entry.item.original.time)} → <b>{fmtDate(entry.item.date)} · {fmtTime(entry.item.time)}</b></div><Button size="sm" variant="secondary" onClick={() => setOpenMatches((current) => ({ ...current, [entry.key]: !current[entry.key] }))}>{open ? "Hide matches" : "Assign a tutor"}</Button></div>
                {open && <div className="mt-3 space-y-2">{options.length ? options.slice(0, 3).map((match, index) => <div key={match.tutor.userId}><button type="button" onClick={() => setChoices((current) => ({ ...current, [entry.key]: match.tutor.userId }))} className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-left ${selectedId === match.tutor.userId ? "border-brand-500 bg-brand-50" : "border-slate-200 bg-white"}`}><span><b>{index + 1}. {match.tutor.fullName}</b><span className="ml-2 text-xs text-slate-500">{match.coverage}/{match.total} sessions · {Math.round(match.score)}% match</span></span>{selectedId === match.tutor.userId && <Badge status="approved">Selected</Badge>}</button><CompatibilityBreakdown match={match}/></div>) : <p className="text-slate-500">No eligible tutor is available for this requested time.</p>}</div>}
              </div>;
            })}
            {errors[bookingId] && <Alert kind="error">{errors[bookingId]}</Alert>}
            <div className="flex justify-end gap-2"><Button size="sm" variant="danger" disabled={busy[bookingId]} onClick={() => rejectReschedule(bookingId)}>Reject reschedule</Button><Button size="sm" variant="success" disabled={busy[bookingId] || entries.some((entry) => !choices[entry.key])} onClick={() => approveReschedule(bookingId, entries)}>{busy[bookingId] ? "Saving…" : "Approve reschedule"}</Button></div>
          </section>)}
          {reassignedEntries.map((entry) => {
            const options = matchingFor(entry);
            const open = openMatches[entry.key];
            return <section key={entry.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-extrabold">{entry.booking?.program === "playgroup" ? "Playgroup" : entry.booking?.program === "reading" ? "Reading" : entry.booking?.subject || "Session"} · {entry.kind === "playgroup" ? "Reassignment" : "Needs reassignment"}</h3><div className="text-sm text-slate-600">{fmtDate(entry.session.date)} · {fmtTime(entry.session.time)} · Previous tutor: {s.db.tutors.find((tutor) => tutor.userId === entry.item.original.tutorId)?.fullName || "—"}</div></div><Button size="sm" variant="secondary" onClick={() => setOpenMatches((current) => ({ ...current, [entry.key]: !current[entry.key] }))}>{open ? "Hide matches" : "Assign a tutor"}</Button></div>
              {open && <div className="mt-3 space-y-2">{options.length ? options.slice(0, 3).map((match, index) => <div key={match.tutor.userId} className="rounded-lg border border-slate-200 bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span><b>{index + 1}. {match.tutor.fullName}</b><span className="ml-2 text-xs text-slate-500">{entry.kind === "playgroup" ? `${match.workload} Playgroup session(s) workload` : `${match.coverage}/${match.total} sessions · ${Math.round(match.score)}% match`}</span></span><Button size="sm" variant="success" disabled={busy[entry.key]} onClick={() => assign(entry, match.tutor.userId)}>{busy[entry.key] ? "Saving…" : "Confirm tutor"}</Button></div><CompatibilityBreakdown match={match}/></div>) : <p className="text-sm text-slate-500">No eligible tutor is available for this session’s current time.</p>}</div>}
              {errors[entry.key] && <div className="mt-2"><Alert kind="error">{errors[entry.key]}</Alert></div>}
            </section>;
          })}
        </div>}
      </Card>;
    })}</div>}
  </div>;
}

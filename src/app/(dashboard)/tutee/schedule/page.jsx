"use client";
import { Star } from "lucide-react";
import { useEffect, useState } from "react";
import { Calendar } from "@/components/Calendar";
import { Badge, Button, Card, Empty, Modal, PageHeader, Textarea, cn } from "@/components/ui";
import { addDays, firstName, fmtDate, fmtDateTime, fmtTime, todayISO, weekday } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function TuteeSchedule() {
    const s = useStore();
    const { bookings, sessions: sessionRows } = s.db;
    const id = s.me.id;
    const [rating, setRating] = useState(null);
    const today = todayISO();
    const [selectedDate, setSelectedDate] = useState(today);
    const statusOf = (booking) => String(booking.status || booking.bookingStatus || "").toLowerCase();
    const isPlaygroup = (booking) => String(booking.program || "").toLowerCase() === "playgroup";
    useEffect(() => {
      const signatureOf = (db) => JSON.stringify({
        playgroups: (db?.bookings || [])
          .filter((booking) => booking.tuteeId === id && isPlaygroup(booking))
          .map((booking) => [booking.id, booking.cohortId || "", statusOf(booking), booking.tutorAssignments || {}, booking.reassignmentPendingDates || {}])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        sessions: (db?.sessions || [])
          .filter((session) => session.tuteeId === id)
          .map((session) => [session.id, session.date, session.time, session.tutorId, session.status])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      });
      const signature = signatureOf({ bookings, sessions: sessionRows });
      const refreshIfChanged = async () => {
        if (document.visibilityState !== "visible") return;
        try {
          const response = await fetch("/api/state", { credentials: "same-origin", cache: "no-store" });
          if (!response.ok) return;
          const payload = await response.json();
          if (signatureOf(payload.db) !== signature) window.location.reload();
        } catch { /* Keep the current page if the refresh check cannot reach the server. */ }
      };
      const timer = window.setInterval(refreshIfChanged, 8000);
      const handleVisibility = () => { if (document.visibilityState === "visible") void refreshIfChanged(); };
      document.addEventListener("visibilitychange", handleVisibility);
      return () => {
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", handleVisibility);
      };
    }, [id, bookings, sessionRows]);
    const sessions = s.db.sessions.filter((x) => {
      const booking = s.db.bookings.find((entry) => entry.id === x.bookingId);
      return x.tuteeId === id && !!booking && booking.paymentStatus === "paid" && ["confirmed", "completed"].includes(booking.status);
    }).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const assessments = s.db.assessments.filter((a) => a.tuteeId === id && a.date && ["booked", "completed"].includes(a.status));
    const playgroupBookings = s.db.bookings.filter((b) => b.tuteeId === id && isPlaygroup(b) && ["approved", "confirmed"].includes(statusOf(b)));
    const upcomingPlaygroupBookings = playgroupBookings.filter((booking) => (booking.dates || []).some((date) => date >= today)).sort((a, b) => String(a.dates?.[0] || "").localeCompare(String(b.dates?.[0] || "")));
    const sessionsByDate = {};
    sessions.forEach((session) => { (sessionsByDate[session.date] ??= []).push(session); });
    const assessmentsByDate = {};
    assessments.forEach((assessment) => { (assessmentsByDate[assessment.date] ??= []).push(assessment); });
    const playgroupsByDate = {};
    playgroupBookings.forEach((booking) => (booking.dates || []).forEach((date) => { (playgroupsByDate[date] ??= []).push(booking); }));
    const daySessions = [...(sessionsByDate[selectedDate] ?? [])].sort((a, b) => a.time.localeCompare(b.time));
    const dayAssessments = [...(assessmentsByDate[selectedDate] ?? [])].sort((a, b) => a.time.localeCompare(b.time));
    const tutor = (tid) => firstName(s.db.tutors.find((t) => t.userId === tid)?.fullName);
    const canRate = (session) => {
        const bookingSessions = s.db.sessions.filter((item) => item.bookingId === session.bookingId && item.status !== "cancelled");
        const finalSession = bookingSessions.slice().sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0];
        return session.status === "completed" && session.id === finalSession?.id && bookingSessions.length > 0 && bookingSessions.every((item) => item.status === "completed");
    };
    const subj = (bid, date, time) => { const booking = s.db.bookings.find((b) => b.id === bid); return booking?.sessionSlots?.find((slot) => slot.date === date && slot.time === time)?.subject || booking?.sessionSubjects?.[date] || booking?.subject || ""; };
    return (<>
      <PageHeader title="My schedule" subtitle="Confirmed matches are added automatically."/>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(400px,1.1fr)_minmax(0,1.4fr)]">
        <Card className="p-3 sm:p-5">
          <Calendar selected={[selectedDate]} onSelect={setSelectedDate} allowPast initialMonth={selectedDate} eventDots mark={(date) => {
              const tones = new Set();
              (sessionsByDate[date] || []).forEach((session) => {
                const booking = s.db.bookings.find((entry) => entry.id === session.bookingId);
                tones.add(booking?.program === "reading" ? "sunny" : "brand");
              });
              if (assessmentsByDate[date]?.length) tones.add("mint");
              if (playgroupsByDate[date]?.length) tones.add("slate");
              return tones.size ? { dots: [...tones] } : null;
          }}/>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>Previous day</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedDate(today)}>Today</Button>
            <Button size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>Next day</Button>
          </div>
          <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 text-[11px] font-semibold text-slate-700 sm:text-xs">
            {[ ["brand", "Academic Sessions"], ["sunny", "Reading Sessions"], ["slate", "Playgroup Class"], ["mint", "Initial Assessments"] ].map(([tone, label]) => <span key={tone} className="flex items-center gap-2"><i className={cn("h-2.5 w-2.5 rounded-full", tone === "brand" ? "bg-brand-600" : tone === "sunny" ? "bg-sunny-400" : tone === "slate" ? "bg-slate-400" : "bg-mint-600")}/>{label}</span>)}
          </div>
        </Card>
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-extrabold">{fmtDate(selectedDate)}</h2>
            <p className="text-sm text-slate-500">{daySessions.length} session{daySessions.length === 1 ? "" : "s"} · {dayAssessments.length} initial assessment{dayAssessments.length === 1 ? "" : "s"} · {playgroupsByDate[selectedDate]?.length ?? 0} Playgroup class{(playgroupsByDate[selectedDate]?.length ?? 0) === 1 ? "" : "es"}</p>
          </div>
          {daySessions.length === 0 && dayAssessments.length === 0 && !(playgroupsByDate[selectedDate]?.length) && <Empty>No sessions or initial assessments on this day.</Empty>}
          {daySessions.map((x) => (<Card key={x.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-20 rounded-xl bg-brand-50 px-3 py-2 text-center font-extrabold text-brand-700">{fmtTime(x.time)}</div>
              <div className="min-w-[180px] flex-1">
                <div className="font-bold">{subj(x.bookingId, x.date, x.time)} · {x.status === "needs_reassignment" ? "---" : tutor(x.tutorId)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <Badge status={x.modality}/>
                  <Badge status={x.status}/>
                </div>
                {x.tutorCheckedInAt
                    ? <div className="mt-1 text-xs font-semibold text-mint-600">Tutor checked you in {fmtDateTime(x.tutorCheckedInAt)}</div>
                    : x.tuteeCheckedInAt && <div className="mt-1 text-xs font-semibold text-mint-600">Checked in {fmtDateTime(x.tuteeCheckedInAt)}</div>}
              </div>
              <div className="flex items-center gap-2">
                {canRate(x) && !x.hasRating && (<Button size="sm" variant="sunny" onClick={() => setRating({ id: x.id, stars: 5, text: "" })}>
                    Rate tutor
                  </Button>)}
                {canRate(x) && x.hasRating && <span className="text-sm text-slate-500">Rating submitted</span>}
              </div>
          </Card>))}
          {dayAssessments.map((assessment) => (<Card key={assessment.id} className="flex flex-wrap items-center gap-3 border-sunny-200 bg-sunny-50/50">
            <div className="min-w-20 rounded-xl bg-sunny-100 px-3 py-2 text-center font-extrabold text-sunny-700">{fmtTime(assessment.time)}</div>
            <div className="min-w-[180px] flex-1">
              <div className="font-bold">Reading · Initial assessment</div>
              <div className="mt-1 text-sm text-slate-500"><Badge status={assessment.modality}/></div>
            </div>
            <Badge status={assessment.status}/>
          </Card>))}
          {(playgroupsByDate[selectedDate] || []).map((booking) => {
            const cohort = s.db.cohorts.find((item) => item.id === booking.cohortId);
            const reassignmentPending = !!booking.reassignmentPendingDates?.[selectedDate];
            const assignedTutorId = reassignmentPending ? null : booking.tutorAssignments?.[selectedDate] || cohort?.weekdayTutorIds?.[weekday(selectedDate)] || booking.tutorId;
            const time = cohort?.time || booking.time || "10:00";
            return <Card key={`playgroup-${booking.id}`} className="flex flex-wrap items-center gap-3 border-mint-200 bg-mint-50/40"><div className="min-w-20 rounded-xl bg-mint-100 px-3 py-2 text-center font-extrabold text-mint-700">{fmtTime(time)}</div><div className="min-w-[180px] flex-1"><div className="font-bold">Playgroup · {cohort?.label || "Class"}</div><div className="mt-1 text-sm text-slate-500">{fmtTime(time)} · {cohort?.modality || "Face-to-Face"} · Tutor {reassignmentPending ? "---" : assignedTutorId ? tutor(assignedTutorId) : "Unassigned"}</div></div><Badge status={reassignmentPending ? "needs_reassignment" : booking.status}>{reassignmentPending ? "Reassignment Pending" : assignedTutorId ? (booking.tutorAssignmentStatus || "Assigned") : "Unassigned"}</Badge></Card>;
          })}
        </section>
      </div>
      {upcomingPlaygroupBookings.length > 0 && <section className="mt-6 space-y-3"><h2 className="text-xl font-extrabold">Enrolled Playgroup cohort</h2>{upcomingPlaygroupBookings.map((booking) => {
        const cohort = s.db.cohorts.find((item) => item.id === booking.cohortId);
        const dates = (booking.dates || []).slice().sort();
        return <Card key={`playgroup-cohort-${booking.id}`} className="flex flex-wrap items-center justify-between gap-3 border-mint-200 bg-mint-50/40"><div><div className="font-extrabold">{cohort?.label || "Playgroup"}</div><div className="text-sm text-slate-600">{dates.length} sessions · {dates[0] && dates[dates.length - 1] ? `${fmtDate(dates[0])} until ${fmtDate(dates[dates.length - 1])}` : "Schedule pending"} · Monday/Wednesday/Friday · {fmtTime(cohort?.time || booking.time || "10:00")}</div></div><Badge status="approved">Approved</Badge></Card>;
      })}</section>}
      <Modal open={!!rating} onClose={() => setRating(null)} title="Rate your tutor">
        {rating && (<div className="space-y-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (<button key={n} onClick={() => setRating({ ...rating, stars: n })} aria-label={`${n} stars`}>
                  <Star className={cn("h-8 w-8", n <= rating.stars ? "fill-sunny-400 text-sunny-400" : "text-slate-300")}/>
                </button>))}
            </div>
            <Textarea placeholder="Share feedback (optional)" value={rating.text} onChange={(e) => setRating({ ...rating, text: e.target.value })}/>
            <Button onClick={() => {
                s.rateSession(rating.id, rating.stars, rating.text);
                setRating(null);
            }}>
              Submit rating
            </Button>
          </div>)}
      </Modal>
    </>);
}

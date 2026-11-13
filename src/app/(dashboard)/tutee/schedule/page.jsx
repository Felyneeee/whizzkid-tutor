"use client";
import { Star } from "lucide-react";
import { useState } from "react";
import { Calendar } from "@/components/Calendar";
import { Badge, Button, Card, Empty, Modal, PageHeader, Textarea, cn } from "@/components/ui";
import { addDays, firstName, fmtDate, fmtDateTime, fmtTime, todayISO, weekday } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function TuteeSchedule() {
    const s = useStore();
    const id = s.me.id;
    const [rating, setRating] = useState(null);
    const today = todayISO();
    const [selectedDate, setSelectedDate] = useState(today);
    const sessions = s.db.sessions.filter((x) => x.tuteeId === id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const assessments = s.db.assessments.filter((a) => a.tuteeId === id && a.date && ["booked", "completed"].includes(a.status));
    const playgroupBookings = s.db.bookings.filter((b) => b.tuteeId === id && b.program === "playgroup" && ["pending", "approved", "confirmed"].includes(b.status));
    const sessionsByDate = {};
    sessions.forEach((session) => { (sessionsByDate[session.date] ??= []).push(session); });
    const assessmentsByDate = {};
    assessments.forEach((assessment) => { (assessmentsByDate[assessment.date] ??= []).push(assessment); });
    const playgroupsByDate = {};
    playgroupBookings.forEach((booking) => (booking.dates || []).forEach((date) => { (playgroupsByDate[date] ??= []).push(booking); }));
    const daySessions = [...(sessionsByDate[selectedDate] ?? [])].sort((a, b) => a.time.localeCompare(b.time));
    const dayAssessments = [...(assessmentsByDate[selectedDate] ?? [])].sort((a, b) => a.time.localeCompare(b.time));
    const tutor = (tid) => firstName(s.db.tutors.find((t) => t.userId === tid)?.fullName);
    const subj = (bid, date, time) => { const booking = s.db.bookings.find((b) => b.id === bid); return booking?.sessionSlots?.find((slot) => slot.date === date && slot.time === time)?.subject || booking?.sessionSubjects?.[date] || booking?.subject || ""; };
    return (<>
      <PageHeader title="My schedule" subtitle="Confirmed matches are added automatically."/>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.4fr)]">
        <Card className="p-3 sm:p-5">
          <Calendar selected={[selectedDate]} onSelect={setSelectedDate} allowPast initialMonth={selectedDate} mark={(date) => {
              const sessionCount = sessionsByDate[date]?.length ?? 0;
              const assessmentCount = assessmentsByDate[date]?.length ?? 0;
              const playgroupCount = playgroupsByDate[date]?.length ?? 0;
              if (!sessionCount && !assessmentCount && !playgroupCount) return null;
              return {
                text: playgroupCount ? `${playgroupCount} Playgroup` : sessionCount ? `${sessionCount} session${sessionCount === 1 ? "" : "s"}` : `${assessmentCount} assessment${assessmentCount === 1 ? "" : "s"}`,
                tone: playgroupCount ? "mint" : sessionCount ? "brand" : "sunny",
                ...((sessionCount || assessmentCount) && playgroupCount ? { subtext: `${sessionCount + assessmentCount} other item${sessionCount + assessmentCount === 1 ? "" : "s"}`, subtone: sessionCount ? "brand" : "sunny" } : {}),
              };
          }}/>
          <div className="mt-4 flex items-center justify-between gap-2">
            <Button size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>Previous day</Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedDate(today)}>Today</Button>
            <Button size="sm" variant="secondary" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>Next day</Button>
          </div>
        </Card>
        <section className="space-y-3">
          <div>
            <h2 className="text-xl font-extrabold">{fmtDate(selectedDate)}</h2>
            <p className="text-sm text-slate-500">{daySessions.length} session{daySessions.length === 1 ? "" : "s"} · {dayAssessments.length} initial assessment{dayAssessments.length === 1 ? "" : "s"} · {playgroupsByDate[selectedDate]?.length ?? 0} Playgroup class{(playgroupsByDate[selectedDate]?.length ?? 0) === 1 ? "" : "es"}</p>
          </div>
          {daySessions.length === 0 && dayAssessments.length === 0 && <Empty>No sessions or initial assessments on this day.</Empty>}
          {daySessions.map((x) => (<Card key={x.id} className="flex flex-wrap items-center gap-3">
              <div className="min-w-20 rounded-xl bg-brand-50 px-3 py-2 text-center font-extrabold text-brand-700">{fmtTime(x.time)}</div>
              <div className="min-w-[180px] flex-1">
                <div className="font-bold">{subj(x.bookingId, x.date, x.time)} · {tutor(x.tutorId)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <Badge status={x.modality}/>
                  <Badge status={x.status}/>
                </div>
                {x.tutorCheckedInAt
                    ? <div className="mt-1 text-xs font-semibold text-mint-600">Tutor checked you in {fmtDateTime(x.tutorCheckedInAt)}</div>
                    : x.tuteeCheckedInAt && <div className="mt-1 text-xs font-semibold text-mint-600">Checked in {fmtDateTime(x.tuteeCheckedInAt)}</div>}
              </div>
              <div className="flex items-center gap-2">
                {x.status === "completed" && !x.rating && (<Button size="sm" variant="sunny" onClick={() => setRating({ id: x.id, stars: 5, text: "" })}>
                    Rate
                  </Button>)}
                {x.rating && <span className="text-sunny-500">{"★".repeat(x.rating)}</span>}
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
            const assignedTutorId = booking.tutorAssignments?.[selectedDate] || cohort?.weekdayTutorIds?.[weekday(selectedDate)] || booking.tutorId;
            const time = cohort?.time || booking.time || "10:00";
            return <Card key={`playgroup-${booking.id}`} className="flex flex-wrap items-center gap-3 border-mint-200 bg-mint-50/40"><div className="min-w-20 rounded-xl bg-mint-100 px-3 py-2 text-center font-extrabold text-mint-700">{fmtTime(time)}</div><div className="min-w-[180px] flex-1"><div className="font-bold">Playgroup · {cohort?.label || "Class"}</div><div className="mt-1 text-sm text-slate-500">{fmtTime(time)} · {cohort?.modality || "Face-to-Face"} · Tutor {assignedTutorId ? tutor(assignedTutorId) : "Unassigned"}</div></div><Badge status={booking.status}>{assignedTutorId ? (booking.tutorAssignmentStatus || "Assigned") : "Unassigned"}</Badge></Card>;
          })}
        </section>
      </div>
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

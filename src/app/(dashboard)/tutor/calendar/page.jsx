"use client";
import { useState } from "react";
import { Calendar } from "@/components/Calendar";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { firstName, fmtDate, fmtTime, todayISO, weekday } from "@/lib/dates";
import { onApprovedLeave } from "@/lib/logic";
import { useStore } from "@/lib/store";
export default function TutorCalendar() {
    const s = useStore();
    const id = s.me.id;
    const [sel, setSel] = useState(todayISO());
    const mine = s.db.sessions.filter((x) => x.tutorId === id && x.status !== "cancelled");
    const day = mine.filter((x) => x.date === sel).sort((a, b) => a.time.localeCompare(b.time));
    const playgroupBookings = s.db.bookings.filter((booking) => booking.program === "playgroup" && ["approved", "confirmed"].includes(booking.status));
    const playgroupAssignments = playgroupBookings.flatMap((booking) => {
      const cohort = s.db.cohorts.find((item) => item.id === booking.cohortId);
      return booking.dates.filter((date) => (booking.tutorAssignments?.[date] || cohort?.weekdayTutorIds?.[weekday(date)] || booking.tutorId) === id).map((date) => ({ booking, date }));
    });
    const playgroupDays = Object.values(playgroupAssignments.reduce((groups, item) => {
      const key = `${item.booking.cohortId || item.booking.id}|${item.date}`;
      if (!groups[key]) groups[key] = { key, cohortId: item.booking.cohortId, date: item.date, bookings: [] };
      groups[key].bookings.push(item.booking);
      return groups;
    }, {}));
    const playgroupDay = playgroupDays.filter((item) => item.date === sel);
    const nm = (tid) => firstName(s.db.tutees.find((x) => x.userId === tid)?.fullName, "Student");
    const subj = (bid, date, time) => { const booking = s.db.bookings.find((b) => b.id === bid); return booking?.sessionSlots?.find((slot) => slot.date === date && slot.time === time)?.subject || booking?.sessionSubjects?.[date] || booking?.subject; };
    const cohorts = s.db.cohorts.filter((cohort) => cohort.tutorId === id || Object.values(cohort.weekdayTutorIds || {}).includes(id));
    const weeklySchedule = s.db.tutorSchedules?.[id];
    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const workingOnDate = (date) => !!weeklySchedule?.days?.[weekdayNames[weekday(date)]];
    return (<>
      <PageHeader title="My calendar" subtitle="Your admin-assigned work days, day off, confirmed sessions, and approved leave."/>
      <div className="grid gap-4 md:grid-cols-2">
        <Calendar selected={[sel]} onSelect={setSel} isDisabled={() => false} mark={(d) => {
            const n = mine.filter((x) => x.date === d).length;
            const pg = playgroupDays.filter((item) => item.date === d).length;
            if (onApprovedLeave(s.db, id, d))
                return { text: "leave", tone: "coral" };
            const working = workingOnDate(d);
            if (!weeklySchedule) return n || pg ? { text: pg ? `${pg} Playgroup` : `${n} sess.`, tone: pg ? "mint" : "brand", ...(n && pg ? { subtext: `${n} other session${n === 1 ? "" : "s"}`, subtone: "brand" } : {}) } : null;
            const isSunday = weekdayNames[weekday(d)] === "Sunday";
            return {
                text: working ? "WORK DAY" : isSunday ? "CLOSED" : "DAY OFF",
                tone: working ? "mint" : "slate",
                subtext: pg ? `${pg} Playgroup` : n ? `${n} session${n === 1 ? "" : "s"}` : undefined,
                subtone: pg ? "mint" : n ? "brand" : "slate",
            };
        }}/>
        <div className="space-y-3">
          <h2 className="font-extrabold">{fmtDate(sel)}</h2>
          {weeklySchedule && <Card className="!p-4"><div className="text-xs font-bold uppercase tracking-wide text-slate-400">Schedule</div><div className="mt-1 font-extrabold">{workingOnDate(sel) ? "Working day" : weekdayNames[weekday(sel)] === "Sunday" ? "Center closed" : "Day off"}</div></Card>}
          {day.length === 0 && <Empty>No sessions.</Empty>}
          {day.map((x) => (<Card key={x.id} className="!p-4">
              <div className="flex items-center justify-between">
                <div className="font-bold">{fmtTime(x.time)} · {nm(x.tuteeId)}</div>
                <Badge status={x.status}/>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                {subj(x.bookingId, x.date, x.time)} <Badge status={x.modality}/>
              </div>
            </Card>))}
          {playgroupDay.map(({ key, cohortId, bookings }) => {
            const cohort = s.db.cohorts.find((item) => item.id === cohortId);
            const time = cohort?.time || bookings[0]?.time || "10:00";
            const students = bookings.map((booking) => nm(booking.tuteeId)).join(", ");
            return <Card key={`playgroup-${key}`} className="!p-4 border-mint-200 bg-mint-50/40"><div className="flex items-center justify-between"><div className="font-bold">{fmtTime(time)} · {cohort?.label || "Playgroup"} · {bookings.length}/6 students</div><Badge status="confirmed">Confirmed</Badge></div><div className="mt-1 text-sm text-slate-500">{fmtTime(time)} · {cohort?.modality || "Face-to-Face"}</div><div className="mt-1 text-xs text-slate-500">{students}</div></Card>;
          })}
          {cohorts.length > 0 && (<Card className="!p-4 text-sm">
              <div className="font-extrabold">Playgroup classes</div>
              {cohorts.map((c) => (<div key={c.id} className="text-slate-500">
                  {c.label} · {fmtTime(c.time || "10:00")} · {c.enrolled.length}/6 enrolled
                </div>))}
            </Card>)}
        </div>
      </div>
    </>);
}

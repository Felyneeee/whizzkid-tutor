"use client";
import { useState } from "react";
import { Alert, Button, Card, Empty, PageHeader } from "@/components/ui";
import { firstName, fmtDate, fmtDateTime, fmtTime, todayISO } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { SessionProgressForm } from "./SessionProgressForm";
export default function MyStudents() {
    const s = useStore();
    const id = s.me.id;
    const [checkInErrors, setCheckInErrors] = useState({});
    const bookings = s.db.bookings.filter((b) => b.tutorId === id && (b.status === "confirmed" || b.status === "completed"));
    const tuteeIds = Array.from(new Set(bookings.map((b) => b.tuteeId)));
    return (<>
      <PageHeader title="My students" subtitle="Assigned students, subjects, grade levels and schedules."/>
      {tuteeIds.length === 0 ? (<Empty>No students assigned yet.</Empty>) : (<div className="grid gap-4 md:grid-cols-2">
          {tuteeIds.map((tid) => {
                const p = s.db.tutees.find((t) => t.userId === tid);
                const bs = bookings.filter((b) => b.tuteeId === tid);
                const sessions = s.db.sessions
                    .filter((x) => x.tutorId === id && x.tuteeId === tid && x.status !== "cancelled")
                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
                return (<Card key={tid}>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-extrabold">{firstName(p?.fullName, "Student")}</div>
                  <span className="text-sm text-slate-500">{p?.gradeLevel || "Grade level not set"}</span>
                </div>
                {bs.map((b) => (<div key={b.id} className="mt-2 rounded-xl bg-slate-50 p-3 text-sm">
                    <div className="font-bold">{b.subject} · {b.gradeLevel}</div>
                    <div className="mt-1 space-y-1 text-slate-500">
                      {sessions.filter((session) => session.bookingId === b.id).length > 0
                            ? sessions.filter((session) => session.bookingId === b.id).map((session) => (<div key={session.id} className="rounded-lg bg-slate-50 p-2">
                              <div>{fmtDate(session.date)} · {fmtTime(session.time)} · <span className="capitalize">{session.status.replace(/_/g, " ")}</span></div>
                              {session.status === "scheduled" && session.date === todayISO() && !session.tutorCheckedInAt && <Button size="sm" variant="success" className="mt-2" onClick={async () => {
                                  const result = await s.checkInSession(session.id);
                                  if (!result.ok) setCheckInErrors((current) => ({ ...current, [session.id]: result.error }));
                              }}>Check in student &amp; record time</Button>}
                              {session.tutorCheckedInAt && <div className="mt-1 text-xs font-semibold text-mint-600">Tutor checked in; student marked present at {fmtDateTime(session.tutorCheckedInAt)}</div>}
                              {checkInErrors[session.id] && <Alert kind="error">{checkInErrors[session.id]}</Alert>}
                              {session.status === "completed" && session.attended === false && <div className="mt-1 text-xs font-semibold text-coral-600">Marked as no-show — progress report is unavailable for this session.</div>}
                              {session.status === "completed" && session.attended !== false && (<SessionProgressForm sessionId={session.id} defaultSubject={b.subject} existing={s.db.progressReports.find((report) => report.sessionId === session.id)}/>)}
                            </div>))
                            : b.dates.map((scheduledDate) => <div key={scheduledDate}>{fmtDate(scheduledDate)} · {fmtTime(b.sessionTimes?.[scheduledDate] ?? b.time)}</div>)}
                    </div>
                  </div>))}
              </Card>);
            })}
        </div>)}
    </>);
}

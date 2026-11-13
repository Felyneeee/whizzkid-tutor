"use client";
import Link from "next/link";
import { Badge, Button, Empty, Alert } from "@/components/ui";
import { addDays, firstName, fmtTime, isBirthdayToday, todayISO, parseISO, toISO } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { Check, Clock3, Hourglass } from "lucide-react";

export default function TuteeHome() {
  const s = useStore();
  const id = s.me.id;
  const profile = s.db.tutees.find((t) => t.userId === id);
  const today = todayISO();
  const weekStart = addDays(today, -((parseISO(today).getDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 6);
  const dateIsThisWeek = (date) => date >= weekStart && date <= weekEnd;
  const upcoming = s.db.sessions
    .filter((x) => x.tuteeId === id && x.status === "scheduled" && x.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const todaySessions = upcoming.filter((x) => x.date === today);
  const showingToday = todaySessions.length > 0;
  const pending = s.db.bookings.filter((b) => b.tuteeId === id && (["pending_assessment", "assessment_scheduled", "ready_for_matching", "awaiting_admin"].includes(b.status) || (b.program === "reading" && b.status === "pending") || !!b.scheduleProposal));
  const linkedAssessmentIds = new Set(s.db.bookings.filter((b) => b.tuteeId === id && b.program === "reading" && ["pending", "pending_assessment", "assessment_scheduled"].includes(b.status)).map((b) => b.assessmentId));
  const assessments = s.db.assessments.filter((a) => a.tuteeId === id && a.status === "booked" && !linkedAssessmentIds.has(a.id));
  const completedCount = s.db.sessions.filter((x) => x.tuteeId === id && x.status === "completed").length;
  const completedThisWeek = s.db.sessions.filter((x) => x.tuteeId === id && x.status === "completed" && dateIsThisWeek(x.date)).length;
  const upcomingThisWeek = upcoming.filter((x) => dateIsThisWeek(x.date)).length;
  const requestsThisWeek = pending.filter((b) => b.createdAt && dateIsThisWeek(toISO(new Date(b.createdAt)))).length;
  const tutorName = (tid) => firstName(s.db.tutors.find((t) => t.userId === tid)?.fullName);
  const displayName = profile?.fullName ? firstName(profile.fullName) : "there";
  const todayDate = parseISO(today);
  const dateLabel = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(todayDate);
  const dayLabel = new Intl.DateTimeFormat("en", { weekday: "long" }).format(todayDate);

  return <div className="space-y-8">
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Welcome to your <span className="text-brand-600">Dashboard</span>, <span className="text-sunny-500">{displayName}!</span></h1>
    </div>

    {profile && isBirthdayToday(profile.birthday) && <div className="rounded-2xl bg-sunny-100 p-4 text-center text-lg font-extrabold">🎂 Happy Birthday, {firstName(profile.fullName)}! 🎉 From all of us at Whizzkids.</div>}
    {!profile?.complete && <Alert kind="warn">Please complete your child&apos;s profile before booking. <Link href="/tutee/profile" className="font-bold underline">Set up profile</Link></Alert>}

    <section aria-label="Session summary" className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl bg-brand-100 p-5 text-brand-700 shadow-sm sm:p-6">
        <Check className="mb-2 h-9 w-9" strokeWidth={2.5} aria-hidden="true" />
        <div className="text-sm font-extrabold sm:text-base">Completed Sessions</div>
        <div className="text-3xl font-extrabold">{completedCount}</div>
        <div className="mt-1 text-xs font-semibold opacity-75">+{completedThisWeek} this week</div>
      </div>
      <div className="rounded-2xl bg-sunny-100 p-5 text-sunny-500 shadow-sm sm:p-6">
        <Hourglass className="mb-2 h-9 w-9" strokeWidth={2.5} aria-hidden="true" />
        <div className="text-sm font-extrabold sm:text-base">Upcoming Sessions</div>
        <div className="text-3xl font-extrabold">{upcoming.length}</div>
        <div className="mt-1 text-xs font-semibold opacity-75">+{upcomingThisWeek} this week</div>
      </div>
      <div className="rounded-2xl bg-slate-200 p-5 text-slate-700 shadow-sm sm:p-6">
        <Clock3 className="mb-2 h-9 w-9" strokeWidth={2.5} aria-hidden="true" />
        <div className="text-sm font-extrabold sm:text-base">Pending Requests</div>
        <div className="text-3xl font-extrabold">{pending.length + assessments.length}</div>
        <div className="mt-1 text-xs font-semibold opacity-75">+{requestsThisWeek} this week</div>
      </div>
    </section>

    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Today’s Sessions</h2>
        <div className="text-right">
          <div className="text-lg font-extrabold text-slate-800">{dateLabel}</div>
          <div className="font-bold text-sunny-500">{dayLabel}</div>
        </div>
      </div>
      {!showingToday ? <Empty>No session today. <Link className="font-bold text-brand-600" href="/tutee/schedule">Check your schedule to see next sessions →</Link></Empty> : <div className="space-y-3">
        {todaySessions.slice(0, 5).map((x) => {
          const b = s.db.bookings.find((y) => y.id === x.bookingId);
          return <div key={x.id} className="flex flex-col gap-3 rounded-2xl border border-slate-300 bg-white/65 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:px-7 sm:py-5">
            <div className="shrink-0 text-lg font-extrabold text-slate-800">{fmtTime(x.time)}</div>
            <div className="min-w-0 flex-1 text-base font-medium text-slate-600">{b?.subject || "Tutoring session"} with {tutorName(x.tutorId)}</div>
            <Badge status={x.modality}>
              {x.modality === "online" ? "Online" : x.modality === "face-to-face" ? "Face-to-Face" : x.modality}
            </Badge>
          </div>;
        })}
        <Link href="/tutee/schedule"><Button variant="ghost" size="sm">View full schedule →</Button></Link>
      </div>}
    </section>
  </div>;
}

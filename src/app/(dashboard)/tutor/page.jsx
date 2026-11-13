"use client";
import Link from "next/link";
import { Badge, Card, Empty } from "@/components/ui";
import { addDays, firstName, fmtTime, isBirthdayToday, parseISO, todayISO } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { Check, Hourglass, UserRound } from "lucide-react";

export default function TutorHome() {
  const s = useStore();
  const id = s.me.id;
  const t = s.db.tutors.find((x) => x.userId === id);
  const today = todayISO();
  const weekStart = addDays(today, -((parseISO(today).getDay() + 6) % 7));
  const weekEnd = addDays(weekStart, 6);
  const dateIsThisWeek = (date) => date >= weekStart && date <= weekEnd;
  const upcoming = s.db.sessions.filter((x) => x.tutorId === id && x.status === "scheduled" && x.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const todaySessions = upcoming.filter((x) => x.date === today);
  const completed = s.db.sessions.filter((x) => x.tutorId === id && x.status === "completed");
  const completedThisWeek = completed.filter((x) => dateIsThisWeek(x.date)).length;
  const upcomingThisWeek = upcoming.filter((x) => dateIsThisWeek(x.date)).length;
  const flagged = s.db.sessions.filter((x) => x.tutorId === id && x.status === "needs_reassignment");
  const students = new Set(s.db.sessions.filter((x) => x.tutorId === id && x.status !== "cancelled").map((x) => x.tuteeId));
  const studentsThisWeek = new Set(upcoming.filter((x) => dateIsThisWeek(x.date)).map((x) => x.tuteeId));
  const pendingLeaves = s.db.leaves.filter((l) => l.tutorId === id && l.status === "pending").length;
  const nm = (tid) => firstName(s.db.tutees.find((x) => x.userId === tid)?.fullName, "Student");
  const subj = (bid, date, time) => { const booking = s.db.bookings.find((b) => b.id === bid); return booking?.sessionSlots?.find((slot) => slot.date === date && slot.time === time)?.subject || booking?.sessionSubjects?.[date] || booking?.subject || "Tutoring session"; };
  const date = parseISO(today);
  const dateLabel = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric" }).format(date);
  const dayLabel = new Intl.DateTimeFormat("en", { weekday: "long" }).format(date);

  return <div className="space-y-8">
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Welcome to your <span className="text-brand-600">Dashboard</span>, <span className="text-sunny-500">{firstName(t?.fullName, "there")}!</span></h1>
    </div>

    {t?.birthday && isBirthdayToday(t.birthday) && <div className="rounded-2xl bg-sunny-100 p-4 text-center font-extrabold">🎂 Happy Birthday from all of us at Whizzkids!</div>}

    <section aria-label="Tutor summary" className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-2xl bg-brand-100 p-5 text-brand-700 shadow-sm sm:p-6">
        <Check className="mb-2 h-9 w-9" strokeWidth={2.5} aria-hidden="true" />
        <div className="text-sm font-extrabold sm:text-base">Completed Sessions</div>
        <div className="text-3xl font-extrabold">{completed.length}</div>
        <div className="mt-1 text-xs font-semibold opacity-75">+{completedThisWeek} this week</div>
      </div>
      <div className="rounded-2xl bg-sunny-100 p-5 text-sunny-500 shadow-sm sm:p-6">
        <Hourglass className="mb-2 h-9 w-9" strokeWidth={2.5} aria-hidden="true" />
        <div className="text-sm font-extrabold sm:text-base">Upcoming Sessions</div>
        <div className="text-3xl font-extrabold">{upcoming.length}</div>
        <div className="mt-1 text-xs font-semibold opacity-75">+{upcomingThisWeek} this week</div>
      </div>
      <div className="rounded-2xl bg-slate-200 p-5 text-slate-700 shadow-sm sm:p-6">
        <UserRound className="mb-2 h-9 w-9" strokeWidth={2.5} aria-hidden="true" />
        <div className="text-sm font-extrabold sm:text-base">No. of Tutees</div>
        <div className="text-3xl font-extrabold">{students.size}</div>
        <div className="mt-1 text-xs font-semibold opacity-75">+{studentsThisWeek.size} this week</div>
      </div>
    </section>

    {flagged.length > 0 && <Card className="border-coral-100 bg-coral-50 !p-4 text-sm text-coral-600">{flagged.length} of your session(s) were flagged for reassignment by the admin (leave/availability change).</Card>}
    {pendingLeaves > 0 && <p className="text-sm text-slate-500">You have {pendingLeaves} leave request(s) awaiting admin approval. <Link href="/tutor/leave" className="font-bold text-brand-600">View leave requests →</Link></p>}

    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">Today’s Sessions</h2>
        <div className="text-right">
          <div className="text-lg font-extrabold text-slate-800">{dateLabel}</div>
          <div className="font-bold text-sunny-500">{dayLabel}</div>
        </div>
      </div>
      {todaySessions.length === 0 ? <Empty>No session today. <Link className="font-bold text-brand-600" href="/tutor/calendar">Check your schedule to see next sessions →</Link></Empty> : <div className="space-y-3">
        {todaySessions.slice(0, 6).map((x) => <div key={x.id} className="flex flex-col gap-3 rounded-2xl border border-slate-300 bg-white/65 px-5 py-4 shadow-sm sm:flex-row sm:items-center sm:gap-6 sm:px-7 sm:py-5">
          <div className="shrink-0 text-lg font-extrabold text-slate-800">{fmtTime(x.time)}</div>
          <div className="min-w-0 flex-1 text-base font-medium text-slate-600">{subj(x.bookingId, x.date, x.time)} with {nm(x.tuteeId)}</div>
          <Badge status={x.modality}>{x.modality === "online" ? "Online" : x.modality === "face-to-face" ? "Face-to-Face" : x.modality}</Badge>
        </div>)}
        <Link href="/tutor/calendar" className="inline-block rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100">View full schedule →</Link>
      </div>}
    </section>
  </div>;
}

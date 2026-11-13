"use client";
import Link from "next/link";
import { Alert, Badge, Button, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { firstName, fmtDate, fmtTime, isBirthdayToday, todayISO } from "@/lib/dates";
import { PROGRAMS } from "@/lib/constants";
import { useStore } from "@/lib/store";
export default function TuteeHome() {
    const s = useStore();
    const id = s.me.id;
    const profile = s.db.tutees.find((t) => t.userId === id);
    const today = todayISO();
    const upcoming = s.db.sessions.filter((x) => x.tuteeId === id && x.status === "scheduled" && x.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const pending = s.db.bookings.filter((b) => b.tuteeId === id && (["pending_assessment", "assessment_scheduled", "ready_for_matching", "awaiting_admin"].includes(b.status) || (b.program === "reading" && b.status === "pending") || !!b.scheduleProposal));
    const linkedAssessmentIds = new Set(s.db.bookings.filter((b) => b.tuteeId === id && b.program === "reading" && ["pending", "pending_assessment", "assessment_scheduled"].includes(b.status)).map((b) => b.assessmentId));
    const assessments = s.db.assessments.filter((a) => a.tuteeId === id && a.status === "booked" && !linkedAssessmentIds.has(a.id));
    const tutorName = (tid) => firstName(s.db.tutors.find((t) => t.userId === tid)?.fullName);
    return (<>
      <PageHeader title={`Hi${profile?.fullName ? `, ${profile.fullName.split(" ")[0]}'s family` : ""}! 👋`} subtitle="Here's what's happening with your learning journey."/>
      {profile && isBirthdayToday(profile.birthday) && (<div className="mb-4 rounded-2xl bg-sunny-100 p-4 text-center text-lg font-extrabold">🎂 Happy Birthday, {profile.fullName.split(" ")[0]}! 🎉 From all of us at Whizzkids.</div>)}
      {!profile?.complete && (<div className="mb-4">
          <Alert kind="warn">
            Please complete your child&apos;s profile before booking.{" "}
            <Link href="/tutee/profile" className="font-bold underline">
              Set up profile
            </Link>
          </Alert>
        </div>)}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Upcoming sessions" value={upcoming.length} tone="brand"/>
        <Stat label="Pending requests" value={pending.length + assessments.length} tone="sunny"/>
        <Stat label="Completed sessions" value={s.db.sessions.filter((x) => x.tuteeId === id && x.status === "completed").length} tone="mint"/>
      </div>

      <h2 className="mb-3 text-lg font-extrabold">Start something new</h2>
      <div className="mb-8 grid gap-3 md:grid-cols-3">
        {Object.keys(PROGRAMS).map((k) => (<Link key={k} href={`/tutee/book?program=${k}`}>
            <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
              <div className="text-3xl">{PROGRAMS[k].emoji}</div>
              <div className="mt-1 font-extrabold">{PROGRAMS[k].name}</div>
              <div className="text-xs font-bold text-brand-600">{PROGRAMS[k].ages}</div>
            </Card>
          </Link>))}
      </div>

      <h2 className="mb-3 text-lg font-extrabold">Next sessions</h2>
      {upcoming.length === 0 ? (<Empty>
          No upcoming sessions yet.{" "}
          <Link className="font-bold text-brand-600" href="/tutee/book">
            Book a program →
          </Link>
        </Empty>) : (<div className="space-y-2">
          {upcoming.slice(0, 5).map((x) => {
                const b = s.db.bookings.find((y) => y.id === x.bookingId);
                return (<Card key={x.id} className="flex flex-wrap items-center gap-3 !p-4">
                <div className="min-w-[160px] font-bold">{fmtDate(x.date)}</div>
                <div className="text-sm">{fmtTime(x.time)}</div>
                <div className="flex-1 text-sm text-slate-500">
                  {b?.subject} with {tutorName(x.tutorId)}
                </div>
                <Badge status={x.modality}/>
              </Card>);
            })}
          <Link href="/tutee/schedule">
            <Button variant="ghost" size="sm">
              View full schedule →
            </Button>
          </Link>
        </div>)}
    </>);
}

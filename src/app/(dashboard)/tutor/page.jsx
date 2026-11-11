"use client";
import Link from "next/link";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { firstName, fmtDate, fmtTime, isBirthdayToday, todayISO } from "@/lib/dates";
import { tutorRating } from "@/lib/logic";
import { useStore } from "@/lib/store";
export default function TutorHome() {
    const s = useStore();
    const id = s.me.id;
    const t = s.db.tutors.find((x) => x.userId === id);
    const today = todayISO();
    const upcoming = s.db.sessions.filter((x) => x.tutorId === id && x.status === "scheduled" && x.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const flagged = s.db.sessions.filter((x) => x.tutorId === id && x.status === "needs_reassignment");
    const rating = tutorRating(s.db, id);
    const students = new Set(s.db.sessions.filter((x) => x.tutorId === id && x.status !== "cancelled").map((x) => x.tuteeId)).size;
    const pendingLeaves = s.db.leaves.filter((l) => l.tutorId === id && l.status === "pending").length;
    const nm = (tid) => firstName(s.db.tutees.find((x) => x.userId === tid)?.fullName, "Student");
    const subj = (bid, date, time) => { const booking = s.db.bookings.find((b) => b.id === bid); return booking?.sessionSlots?.find((slot) => slot.date === date && slot.time === time)?.subject || booking?.sessionSubjects?.[date] || booking?.subject; };
    return (<>
      <PageHeader title={`Hello, ${t.fullName.split(" ")[0]}!`} subtitle="Your teaching overview"/>
      {t.birthday && isBirthdayToday(t.birthday) && <div className="mb-4 rounded-2xl bg-sunny-100 p-4 text-center font-extrabold">🎂 Happy Birthday from all of us at Whizzkids!</div>}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Upcoming sessions" value={upcoming.length} tone="brand"/>
        <Stat label="Students" value={students} tone="mint"/>
        <Stat label="Avg. rating" value={rating ? `${rating.toFixed(1)} ★` : "—"} tone="sunny"/>
      </div>
      {flagged.length > 0 && (<Card className="mb-4 border-coral-100 bg-coral-50 !p-4 text-sm text-coral-600">
          {flagged.length} of your session(s) were flagged for reassignment by the admin (leave/availability change).
        </Card>)}
      {pendingLeaves > 0 && (<p className="mb-4 text-sm text-slate-500">
          You have {pendingLeaves} leave request(s) awaiting admin approval.{" "}
          <Link href="/tutor/leave" className="font-bold text-brand-600">
            View leave requests →
          </Link>
        </p>)}
      <h2 className="mb-3 text-lg font-extrabold">Upcoming sessions</h2>
      {upcoming.length === 0 ? (<Empty>Nothing scheduled yet. Make sure your availability is submitted and approved.</Empty>) : (<div className="space-y-2">
          {upcoming.slice(0, 6).map((x) => (<Card key={x.id} className="flex flex-wrap items-center gap-3 !p-4">
              <div className="min-w-[150px] font-bold">{fmtDate(x.date)}</div>
              <div className="text-sm">{fmtTime(x.time)}</div>
              <div className="flex-1 text-sm text-slate-500">
                {nm(x.tuteeId)} — {subj(x.bookingId, x.date, x.time)}
              </div>
              <Badge status={x.modality}/>
            </Card>))}
        </div>)}
    </>);
}

"use client";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Card, PageHeader, Stat, peso } from "@/components/ui";
import { addDays, fmtShort, monthKey, todayISO } from "@/lib/dates";
import { payrollFor, tutorRating } from "@/lib/logic";
import { useStore } from "@/lib/store";
export default function AdminHome() {
    const s = useStore();
    const db = s.db;
    const today = todayISO();
    const month = monthKey(today);
    const completed = db.sessions.filter((x) => x.status === "completed");
    const attended = completed.filter((x) => x.attended !== false).length;
    const conflicts = db.sessions.filter((x) => x.status === "needs_reassignment").length;
    const payroll = db.tutors.filter((t) => t.status === "active").reduce((a, t) => a + (payrollFor(db, t.userId, month)?.amount || 0), 0);
    const rated = db.sessions.filter((x) => typeof x.rating === "number");
    const avg = rated.length ? rated.reduce((a, x) => a + (x.rating || 0), 0) / rated.length : null;
    const queue = [
        { label: "Tutor applications / verifications", n: db.tutors.filter((t) => ["pending_review", "interview", "pending_verification"].includes(t.status)).length, href: "/admin/applications" },
        { label: "Booking requests to match", n: db.bookings.filter((b) => b.status === "awaiting_admin").length, href: "/admin/matching" },
        { label: "Availability batches pending", n: new Set(db.availability.filter((a) => a.status === "pending").map((a) => a.batchId)).size, href: "/admin/approvals" },
        { label: "Leave requests pending", n: db.leaves.filter((l) => l.status === "pending" && db.tutors.some((t) => t.userId === l.tutorId)).length, href: "/admin/approvals" },
        { label: "Assessments to record", n: db.assessments.filter((a) => a.status === "booked").length, href: "/admin/assessments" },
        { label: "Sessions needing reassignment", n: conflicts, href: "/admin/scheduling" },
        { label: "Purchase orders", n: db.purchases.filter((p) => p.status === "pending").length, href: "/admin/orders" },
    ];
    // sessions per week (last 4 weeks incl. current)
    const weeks = [3, 2, 1, 0].map((w) => {
        const from = addDays(today, -7 * (w + 1) + 1);
        const to = addDays(today, -7 * w);
        return { label: `${fmtShort(from)}`, n: db.sessions.filter((x) => x.status === "completed" && x.date >= from && x.date <= to).length };
    });
    const max = Math.max(1, ...weeks.map((w) => w.n));
    const byProgram = ["reading", "academic", "playgroup"].map((p) => ({ p, n: db.bookings.filter((b) => b.program === p && b.status !== "rejected").length }));
    return (<>
      <PageHeader title="Admin command center" subtitle="Everything that needs your attention today."/>
      {conflicts > 0 && (<Link href="/admin/scheduling" className="mb-4 flex items-center gap-2 rounded-2xl border border-coral-100 bg-coral-50 p-4 text-sm font-bold text-coral-600">
          <AlertTriangle className="h-4 w-4"/> {conflicts} confirmed session(s) need tutor reassignment (leave or availability change).
        </Link>)}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Tutees" value={db.tutees.length} tone="brand"/>
        <Stat label="Active tutors" value={db.tutors.filter((t) => t.status === "active").length} tone="mint"/>
        <Stat label="Attendance rate" value={completed.length ? `${Math.round((attended / completed.length) * 100)}%` : "—"} tone="sunny" sub={`${completed.length} completed sessions`}/>
        <Stat label="Payroll this month" value={peso(payroll)} tone="coral" sub={avg ? `Avg rating ${avg.toFixed(1)} ★` : undefined}/>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-extrabold">Action queue</h2>
          <ul className="divide-y divide-slate-100">
            {queue.map((q) => (<li key={q.label}>
                <Link href={q.href} className="flex items-center justify-between py-2 text-sm hover:text-brand-700">
                  <span>{q.label}</span>
                  <span className={q.n ? "rounded-full bg-coral-500 px-2 py-0.5 text-xs font-bold text-white" : "text-xs text-slate-300"}>{q.n}</span>
                </Link>
              </li>))}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 font-extrabold">Completed sessions (last 4 weeks)</h2>
          <div className="flex h-40 items-end gap-4">
            {weeks.map((w) => (<div key={w.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs font-bold">{w.n}</span>
                <div className="w-full rounded-t-lg bg-brand-500" style={{ height: `${(w.n / max) * 100}%`, minHeight: 4 }}/>
                <span className="text-[10px] text-slate-400">from {w.label}</span>
              </div>))}
          </div>
          <h3 className="mb-2 mt-5 text-sm font-extrabold">Bookings by program</h3>
          <div className="space-y-2">
            {byProgram.map((b) => (<div key={b.p} className="flex items-center gap-2 text-sm">
                <span className="w-24 capitalize">{b.p}</span>
                <div className="h-3 flex-1 rounded-full bg-slate-100">
                  <div className="h-3 rounded-full bg-sunny-400" style={{ width: `${Math.min(100, b.n * 25)}%` }}/>
                </div>
                <span className="w-6 text-right font-bold">{b.n}</span>
              </div>))}
          </div>
          <div className="mt-4 text-xs text-slate-400">Top tutor rating: {Math.max(0, ...db.tutors.map((t) => tutorRating(db, t.userId) || 0)).toFixed(1)} ★</div>
        </Card>
      </div>
    </>);
}

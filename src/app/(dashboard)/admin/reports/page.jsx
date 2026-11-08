"use client";
import { Download } from "lucide-react";
import { Button, Card, PageHeader, Stat, Table, Td } from "@/components/ui";
import { tutorRating } from "@/lib/logic";
import { useStore } from "@/lib/store";
export default function Reports() {
    const s = useStore();
    const db = s.db;
    const bookings = db.bookings;
    const done = db.sessions.filter((x) => x.status === "completed");
    const attended = done.filter((x) => x.attended !== false).length;
    const rated = db.sessions.filter((x) => typeof x.rating === "number");
    const avg = rated.length ? rated.reduce((a, x) => a + (x.rating || 0), 0) / rated.length : null;
    const status = ["awaiting_admin", "confirmed", "completed", "rejected", "terminated"];
    const rows = db.tutors.filter((t) => t.status === "active").map((t) => {
        const mine = db.sessions.filter((x) => x.tutorId === t.userId);
        return {
            name: t.fullName,
            students: new Set(db.bookings.filter((b) => b.tutorId === t.userId && b.status === "confirmed").map((b) => b.tuteeId)).size,
            scheduled: mine.filter((x) => x.status === "scheduled").length,
            completed: mine.filter((x) => x.status === "completed").length,
            rating: tutorRating(db, t.userId),
        };
    });
    const exportCsv = () => {
        const csv = ["Tutor,Students,Scheduled,Completed,Rating", ...rows.map((r) => [r.name, r.students, r.scheduled, r.completed, r.rating?.toFixed(1) ?? ""].join(","))].join("\n");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
        a.download = "whizzkids-report.csv";
        a.click();
    };
    return (<>
      <PageHeader title="Reports & monitoring" subtitle="Bookings, tutor assignments, completed sessions and ratings." action={<Button variant="secondary" onClick={exportCsv}><Download className="h-4 w-4"/> Export CSV</Button>}/>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total bookings" value={bookings.length} tone="brand"/>
        <Stat label="Completed sessions" value={done.length} tone="mint" sub={done.length ? `${Math.round((attended / done.length) * 100)}% attended` : undefined}/>
        <Stat label="Average rating" value={avg ? `${avg.toFixed(1)} ★` : "—"} tone="sunny" sub={`${rated.length} rated`}/>
        <Stat label="Tutors" value={rows.length} tone="coral"/>
      </div>
      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-extrabold">Bookings by status</h2>
          {status.map((st) => {
            const n = bookings.filter((b) => b.status === st).length;
            return (<div key={st} className="mb-2 flex items-center gap-2 text-sm"><span className="w-32 capitalize">{st.replace("_", " ")}</span><div className="h-3 flex-1 rounded-full bg-slate-100"><div className="h-3 rounded-full bg-brand-500" style={{ width: `${bookings.length ? (n / bookings.length) * 100 : 0}%` }}/></div><span className="w-6 text-right font-bold">{n}</span></div>);
        })}
        </Card>
        <Card>
          <h2 className="mb-3 font-extrabold">Bookings by program & modality</h2>
          {["reading", "academic", "playgroup"].map((p) => (<div key={p} className="flex justify-between border-b border-slate-100 py-2 text-sm last:border-0"><span className="capitalize">{p}</span><span><b>{bookings.filter((b) => b.program === p).length}</b> <span className="text-slate-400">({bookings.filter((b) => b.program === p && b.modality === "online").length} online / {bookings.filter((b) => b.program === p && b.modality === "face-to-face").length} F2F)</span></span></div>))}
        </Card>
      </div>
      <h2 className="mb-2 font-extrabold">Tutor summary</h2>
      <Table head={["Tutor", "Active students", "Upcoming", "Completed", "Rating"]}>
        {rows.map((r) => <tr key={r.name}><Td className="font-bold">{r.name}</Td><Td>{r.students}</Td><Td>{r.scheduled}</Td><Td>{r.completed}</Td><Td>{r.rating ? `${r.rating.toFixed(1)} ★` : "—"}</Td></tr>)}
      </Table>
    </>);
}

"use client";
import { Badge, Card, Empty, PageHeader, Stat } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { useStore } from "@/lib/store";
const STATUS_LABELS = { not_started: "Not started", practicing: "Practicing", mastered: "Mastered" };
export default function TuteeProgressPage() {
    const store = useStore();
    const id = store.me.id;
    const reports = (store.db.progressReports ?? []).filter((report) => report.tuteeId === id).sort((a, b) => b.sessionDate.localeCompare(a.sessionDate) || b.submittedAt.localeCompare(a.submittedAt));
    const latest = reports[0];
    const mastered = reports.filter((report) => report.status === "mastered").length;
    const latestScore = reports.find((report) => report.score !== null)?.score;
    return (<>
      <PageHeader title="Learning progress" subtitle="See recent learning goals, progress, and mastery checks."/>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Progress updates" value={reports.length} tone="brand"/>
        <Stat label="Skills marked mastered" value={mastered} tone="mint"/>
        <Stat label="Latest mastery check" value={latestScore == null ? "—" : `${latestScore}%`} tone="sunny"/>
      </div>
      {reports.length === 0 ? <Empty>Your tutor's progress updates will appear here after completed sessions.</Empty> : (<div className="space-y-3">
          {reports.map((report) => (<Card key={report.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-brand-600">{report.subject}</div>
                  <h2 className="text-lg font-extrabold">{report.skill}</h2>
                  <p className="text-sm text-slate-500">Session {fmtDate(report.sessionDate)}</p>
                </div>
                <Badge status={report.status}>{STATUS_LABELS[report.status] ?? report.status}</Badge>
              </div>
              <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                <div><div className="text-xs font-bold uppercase text-slate-400">Learning goal</div><p>{report.learningGoal}</p></div>
                <div><div className="text-xs font-bold uppercase text-slate-400">Evidence of learning</div><p>{report.evidence}</p></div>
                <div><div className="text-xs font-bold uppercase text-slate-400">Mastery check</div><p>{report.score === null ? "No score recorded" : `${report.score}%`}</p></div>
                <div><div className="text-xs font-bold uppercase text-slate-400">Next step</div><p>{report.nextStep}</p></div>
              </div>
            </Card>))}
        </div>)}
    </>);
}

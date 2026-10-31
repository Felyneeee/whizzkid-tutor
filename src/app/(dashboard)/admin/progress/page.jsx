"use client";
import { useState } from "react";
import { Badge, Card, Empty, PageHeader, Select, Table, Td } from "@/components/ui";
import { fmtDate, fmtShort } from "@/lib/dates";
import { useStore } from "@/lib/store";
const statusLabel = (status) => status.replace(/_/g, " ");
function ScoreChart({ reports }) {
    const scored = reports.filter((report) => report.score !== null).sort((a, b) => a.sessionDate.localeCompare(b.sessionDate));
    if (!scored.length)
        return <Empty>No mastery check scores for this subject yet. Tutors can add a score when they record a mastery check.</Empty>;
    const width = Math.max(360, Math.min(720, scored.length * 100));
    const height = 250;
    const left = 42;
    const right = width - 18;
    const top = 20;
    const bottom = 198;
    const x = (index) => scored.length === 1 ? (left + right) / 2 : left + (index / (scored.length - 1)) * (right - left);
    const y = (score) => bottom - (score / 100) * (bottom - top);
    const points = scored.map((report, index) => `${x(index)},${y(report.score)}`).join(" ");
    return (<div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-auto min-w-full" role="img" aria-label="Mastery check scores over time">
        {[0, 25, 50, 75, 100].map((value) => <g key={value}>
          <line x1={left} x2={right} y1={y(value)} y2={y(value)} stroke="#e2e8f0" strokeDasharray={value === 0 ? undefined : "4 4"}/>
          <text x={left - 8} y={y(value) + 4} textAnchor="end" fill="#64748b" fontSize="11">{value}%</text>
        </g>)}
        <polyline points={points} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round"/>
        {scored.map((report, index) => <g key={report.id}>
          <circle cx={x(index)} cy={y(report.score)} r="5" fill="#2563eb"><title>{report.score}% — {fmtDate(report.sessionDate)}: {report.skill}</title></circle>
          <text x={x(index)} y={y(report.score) - 10} textAnchor="middle" fill="#1e293b" fontSize="11" fontWeight="700">{report.score}%</text>
          <text x={x(index)} y={bottom + 22} textAnchor="middle" fill="#64748b" fontSize="11">{fmtShort(report.sessionDate)}</text>
        </g>)}
        <text x="10" y="14" fill="#64748b" fontSize="11">Score</text>
      </svg>
    </div>);
}
export default function AdminProgressPage() {
    const store = useStore();
    const tutees = [...store.db.tutees].sort((a, b) => a.fullName.localeCompare(b.fullName));
    const [activeId, setActiveId] = useState("");
    const [subjectFilter, setSubjectFilter] = useState("");
    const selectedId = tutees.some((tutee) => tutee.userId === activeId) ? activeId : tutees[0]?.userId ?? "";
    const selected = tutees.find((tutee) => tutee.userId === selectedId);
    const reports = store.db.progressReports ?? [];
    const selectedReports = reports.filter((report) => report.tuteeId === selectedId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const subjects = Array.from(new Set(selectedReports.map((report) => report.subject))).sort();
    const currentSubject = subjects.includes(subjectFilter) ? subjectFilter : subjects[0] ?? "";
    const chartReports = selectedReports.filter((report) => report.subject === currentSubject);
    return (<>
      <PageHeader title="Student learning progress" subtitle="Named student summaries and mastery-check trends."/>
      {tutees.length === 0 ? <Empty>No tutee profiles yet.</Empty> : <>
        <Card className="mb-5">
          <h2 className="mb-3 font-extrabold">Tutee overview</h2>
          <Table head={["Tutee", "Subjects tracked", "Latest progress", "Last updated"]}>
            {tutees.map((tutee) => {
                const latest = reports.filter((report) => report.tuteeId === tutee.userId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
                const subjectCount = new Set(reports.filter((report) => report.tuteeId === tutee.userId).map((report) => report.subject)).size;
                return <tr key={tutee.userId} className={selectedId === tutee.userId ? "bg-brand-50/60" : ""}>
                <Td><button className="font-bold text-brand-700 hover:underline" onClick={() => { setActiveId(tutee.userId); setSubjectFilter(""); }}>{tutee.fullName}</button></Td>
                <Td>{subjectCount || "—"}</Td>
                <Td>{latest ? <><span className="capitalize">{statusLabel(latest.status)}</span><span className="text-slate-400"> · {latest.skill}</span></> : "No reports yet"}</Td>
                <Td>{latest ? fmtDate(latest.submittedAt.slice(0, 10)) : "—"}</Td>
              </tr>;
            })}
          </Table>
        </Card>

        {selected && <>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div><h2 className="text-xl font-extrabold">{selected.fullName}</h2><p className="text-sm text-slate-500">{selected.gradeLevel || "Grade level not set"} · overall learning progress</p></div>
            {subjects.length > 0 && <div className="w-full sm:w-64"><Select aria-label="Subject for chart" value={currentSubject} onChange={(e) => setSubjectFilter(e.target.value)}>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}</Select></div>}
          </div>
          <Card className="mb-5">
            <h3 className="mb-1 font-extrabold">Mastery checks over time{currentSubject ? ` · ${currentSubject}` : ""}</h3>
            <p className="mb-4 text-xs text-slate-500">Only actual tutor-entered mastery-check scores are plotted.</p>
            {chartReports.length ? <ScoreChart reports={chartReports}/> : <Empty>No progress reports have been submitted for this student yet.</Empty>}
          </Card>
          {selectedReports.length > 0 && <>
            <h3 className="mb-2 font-extrabold">Latest skill summaries</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {selectedReports.slice(0, 8).map((report) => <Card key={report.id}>
                <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-xs font-bold uppercase text-slate-400">{report.subject}</div><div className="font-extrabold">{report.skill}</div></div><Badge status={report.status}>{statusLabel(report.status)}</Badge></div>
                <div className="mt-3 flex items-center justify-between text-sm"><span className="text-slate-500">{fmtDate(report.submittedAt.slice(0, 10))}</span><span className="font-bold">{report.score === null ? "No mastery score" : `${report.score}% mastery check`}</span></div>
              </Card>)}
            </div>
          </>}
        </>}
      </>}
    </>);
}

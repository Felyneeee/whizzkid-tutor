"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Search, SlidersHorizontal, X } from "lucide-react";
import { Alert, Button, Card, Empty, Input, Modal, PageHeader, Select, cn } from "@/components/ui";
import { firstName, fmtDate, fmtTime } from "@/lib/dates";
import { useStore } from "@/lib/store";

const SESSION_MINUTES = 45;
const SUBJECT_TONES = [
  "bg-sunny-100 text-slate-800",
  "bg-coral-100 text-slate-800",
  "bg-mint-100 text-slate-800",
  "bg-brand-100 text-slate-800",
];

function sessionSubject(session, booking) {
  const subject = booking?.sessionSlots?.find((slot) => slot.date === session.date && slot.time === session.time)?.subject
    || booking?.sessionSubjects?.[session.date]
    || booking?.subject
    || "Araling Panipunan";
  if (subject === "Tutoring") return "Araling Panipunan";
  if (subject === "Mathematics") return "Math";
  if (subject === "Araling Panipunan (AP)" || subject === "AP") return "Araling Panipunan";
  return subject;
}

function sessionEnd(session) {
  const [hour, minute] = session.time.split(":").map(Number);
  const end = new Date(`${session.date}T00:00:00`);
  end.setHours(hour, minute + (Number(session.durationMinutes) || SESSION_MINUTES), 0, 0);
  return end;
}

function gradeLabel(grade) {
  return /^grade\b/i.test(grade) ? grade : `Grade ${grade}`;
}

function StudentSessions({ student, sessions, bookings, onClose }) {
  const s = useStore();
  const [tab, setTab] = useState("upcoming");
  const [actionError, setActionError] = useState("");
  const [savingId, setSavingId] = useState("");
  const visibleSessions = sessions.filter((session) => tab === "completed"
    ? session.status === "completed"
    : session.status !== "completed");

  const markAttendance = async (session, attended) => {
    setSavingId(session.id);
    setActionError("");
    try {
      const result = await s.completeSession(session.id, attended);
      if (result?.ok === false) setActionError(result.error || "Could not update this session.");
    } catch (error) {
      setActionError(error?.message || "Could not update this session.");
    } finally {
      setSavingId("");
    }
  };

  return <Modal open onClose={onClose} title={`${student.name} · ${gradeLabel(student.grade)}`} wide>
    <div className="mb-4 flex max-w-sm gap-2">
      {["upcoming", "completed"].map((id) => <button key={id} type="button" onClick={() => setTab(id)} aria-pressed={tab === id} className={cn("flex-1 rounded-xl px-4 py-2 text-sm font-semibold", tab === id ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200")}>
        {id === "upcoming" ? "Upcoming" : "Completed"}
      </button>)}
    </div>
    {actionError && <Alert kind="error">{actionError}</Alert>}
    {visibleSessions.length === 0 ? <Empty>{tab === "upcoming" ? "No upcoming sessions." : "No completed sessions yet."}</Empty> : <div className="space-y-3">
      {visibleSessions.map((session) => {
        const booking = bookings.find((entry) => entry.id === session.bookingId);
        const isComplete = session.status === "completed";
        const canRecord = !isComplete && session.status === "scheduled" && sessionEnd(session) <= new Date();
        const subject = sessionSubject(session, booking);
        return <div key={session.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50/70 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-bold">{subject}</span>
              <span className="text-xs text-slate-500">{fmtDate(session.date)}</span>
            </div>
            <div className="mt-1 text-xs text-slate-600">{fmtTime(session.time)} – {fmtTime(sessionEnd(session).toTimeString().slice(0, 5))}</div>
          </div>
          {isComplete ? <span className={cn("rounded-full px-3 py-2 text-xs font-semibold", session.attended === false ? "bg-coral-100 text-coral-700" : "bg-mint-100 text-mint-700")}>
            {session.attended === false ? "No-show" : "Completed"}
          </span> : canRecord ? <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={savingId === session.id} onClick={() => markAttendance(session, true)}><Check className="h-3.5 w-3.5"/> Mark as Complete</Button>
            <Button size="sm" variant="secondary" disabled={savingId === session.id} onClick={() => markAttendance(session, false)}>Mark as No-show</Button>
          </div> : <span className="rounded-full bg-slate-200 px-3 py-2 text-xs font-medium text-slate-600">{session.status === "scheduled" ? "Available after session" : session.status.replace(/_/g, " ")}</span>}
        </div>;
      })}
    </div>}
  </Modal>;
}

export default function MyStudents() {
  const s = useStore();
  const tutorId = s.me.id;
  const [query, setQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [gradeFilter, setGradeFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  const students = useMemo(() => {
    const assignedIds = new Set(s.db.sessions.filter((session) => session.tutorId === tutorId && session.status !== "cancelled").map((session) => session.bookingId));
    const bookings = s.db.bookings.filter((booking) => assignedIds.has(booking.id) && ["confirmed", "completed"].includes(booking.status));
    const tuteeIds = [...new Set(bookings.map((booking) => booking.tuteeId))];

    return tuteeIds.map((tuteeId) => {
      const profile = s.db.tutees.find((entry) => entry.userId === tuteeId);
      const studentBookings = bookings.filter((booking) => booking.tuteeId === tuteeId);
      const sessions = s.db.sessions.filter((session) => session.tutorId === tutorId && session.tuteeId === tuteeId && session.status !== "cancelled")
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
      const subjects = [...new Set(sessions.map((session) => sessionSubject(session, studentBookings.find((booking) => booking.id === session.bookingId))))];
      const subjectProgress = subjects.map((subject) => {
        const subjectSessions = sessions.filter((session) => sessionSubject(session, studentBookings.find((booking) => booking.id === session.bookingId)) === subject);
        return { subject, completed: subjectSessions.filter((session) => session.status === "completed").length, total: subjectSessions.length };
      });
      const grade = studentBookings.find((booking) => booking.gradeLevel)?.gradeLevel || profile?.gradeLevel || "Not set";
      const nextBySubject = subjects.map((subject) => ({
        subject,
        session: sessions.find((session) => session.status === "scheduled" && sessionEnd(session) > new Date() && sessionSubject(session, studentBookings.find((booking) => booking.id === session.bookingId)) === subject),
      })).filter((entry) => entry.session);
      return {
        id: tuteeId,
        name: firstName(profile?.fullName, "Student"),
        grade,
        bookings: studentBookings,
        sessions,
        subjects,
        subjectProgress,
        nextBySubject,
        completedCount: sessions.filter((session) => session.status === "completed").length,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [s.db.bookings, s.db.sessions, s.db.tutees, tutorId]);

  const grades = [...new Set(students.map((student) => student.grade))].sort((a, b) => a.localeCompare(b));
  const subjects = [...new Set(students.flatMap((student) => student.subjects))].sort((a, b) => a.localeCompare(b));
  const normalizedQuery = query.trim().toLowerCase();
  const filteredStudents = students.filter((student) => {
    const matchesSearch = !normalizedQuery || [student.name, student.grade, ...student.subjects].some((value) => value.toLowerCase().includes(normalizedQuery));
    return matchesSearch && (gradeFilter === "all" || student.grade === gradeFilter) && (subjectFilter === "all" || student.subjects.includes(subjectFilter));
  });
  const selectedStudent = students.find((student) => student.id === selectedStudentId);

  return <>
    <PageHeader title="My students"/>
    <div className="mb-5 flex items-center gap-3">
      <label className="relative block min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" aria-hidden="true"/>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student by name, grade level, or subject" aria-label="Search students" className="h-12 rounded-2xl border-slate-900 bg-slate-50 pl-12"/>
      </label>
      <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen} aria-label="Filter students" className={cn("grid h-12 w-12 shrink-0 place-items-center rounded-xl text-brand-600 hover:bg-brand-50", filtersOpen && "bg-brand-50")}>
        <SlidersHorizontal className="h-6 w-6" aria-hidden="true"/>
      </button>
    </div>
    {filtersOpen && <Card className="mb-5 !p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Grade level
          <Select className="mt-1 normal-case tracking-normal" value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>
            <option value="all">All grade levels</option>{grades.map((grade) => <option key={grade} value={grade}>{grade}</option>)}
          </Select>
        </label>
        <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Subject
          <Select className="mt-1 normal-case tracking-normal" value={subjectFilter} onChange={(event) => setSubjectFilter(event.target.value)}>
            <option value="all">All subjects</option>{subjects.map((subject) => <option key={subject} value={subject}>{subject}</option>)}
          </Select>
        </label>
      </div>
      {(gradeFilter !== "all" || subjectFilter !== "all") && <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700" onClick={() => { setGradeFilter("all"); setSubjectFilter("all"); }}><X className="h-3.5 w-3.5"/> Clear filters</button>}
    </Card>}
    {filteredStudents.length === 0 ? <Empty>{students.length ? "No students match your search or filters." : "No students assigned yet."}</Empty> : <div className="space-y-4">
      {filteredStudents.map((student) => <Card key={student.id} className="!rounded-3xl !border-0 !p-4 shadow-none sm:!px-6 sm:!py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-extrabold tracking-tight text-slate-950">{student.name}</h2>
              <span className="rounded-full bg-brand-100 px-2.5 py-1.5 text-xs">{gradeLabel(student.grade)}</span>
              {student.subjectProgress.map(({ subject, completed, total }, index) => <span key={subject} className={cn("rounded-full px-2.5 py-1.5 text-xs", SUBJECT_TONES[index % SUBJECT_TONES.length])}>
                {subject}{student.subjects.length >= 2 && <span className="ml-1 text-[10px] opacity-75">{completed}/{total} completed</span>}
              </span>)}
            </div>
            {student.nextBySubject.length > 0 && <div className="mt-4 flex flex-wrap gap-2">
              {student.nextBySubject.map(({ subject, session }) => <div key={subject} className="rounded-lg border border-slate-800 bg-slate-50 px-3 py-2 text-xs">
                <div className="flex items-center justify-between gap-5"><span className="font-bold uppercase">Next session</span>{student.subjects.length > 1 && <span>{subject}</span>}</div>
                <div className="mt-1">{fmtDate(session.date)} • {fmtTime(session.time)}</div>
              </div>)}
            </div>}
          </div>
          <div className="flex shrink-0 flex-col items-start gap-4 sm:items-end">
            <div className="text-xs">{student.completedCount} / {student.sessions.length} sessions completed</div>
            <Button onClick={() => setSelectedStudentId(student.id)} className="rounded-full !px-4 !py-2.5 text-xs font-medium"><CalendarDays className="h-4 w-4"/> View Sessions ({student.sessions.length})</Button>
          </div>
        </div>
      </Card>)}
    </div>}
    {selectedStudent && <StudentSessions student={selectedStudent} sessions={selectedStudent.sessions} bookings={selectedStudent.bookings} onClose={() => setSelectedStudentId(null)}/>}
  </>;
}

"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Calendar } from "@/components/Calendar";
import { TutorialBooking } from "@/components/TutorialBooking";
import { Alert, Badge, Button, Card, Chips, Field, PageHeader, Select, Textarea, cn, peso } from "@/components/ui";
import { PLAYGROUP_SESSION_RATE, PROGRAMS, READING_SKILLS, SUBJECTS } from "@/lib/constants";
import { fmtDate, fmtTime, parseISO, todayISO } from "@/lib/dates";
import { cohortSessionDates } from "@/lib/logic";
import { useStore } from "@/lib/store";
const GRADE_CHOICES = ["Nursery", "Preschool", "Kinder", ...Array.from({ length: 10 }, (_, index) => `Grade ${index + 1}`)];
const gradeChoiceForProfile = (grade) => {
    if (GRADE_CHOICES.includes(grade)) return grade;
    if (grade === "Elementary") return "Grade 1";
    if (grade === "High School") return "Grade 7";
    return "";
};
const gradeLevelForBooking = (grade) => ({
    Nursery: "Nursery",
    Preschool: "Kinder",
    Kinder: "Kinder",
}[grade] || (GRADE_CHOICES.includes(grade) && grade.startsWith("Grade ") ? grade : ""));
function ageMonths(bday) {
    if (!bday)
        return null;
    const b = parseISO(bday);
    const n = new Date();
    return (n.getFullYear() - b.getFullYear()) * 12 + (n.getMonth() - b.getMonth()) - (n.getDate() < b.getDate() ? 1 : 0);
}
function ModalityPicker({ value, onChange }) {
    return (<div className="grid grid-cols-2 gap-2">
      {["online", "face-to-face"].map((m) => (<button key={m} type="button" onClick={() => onChange(m)} className={cn("rounded-xl border-2 p-3 text-sm font-bold capitalize", value === m ? "border-brand-500 bg-brand-50" : "border-slate-200")}>
          {m === "online" ? "💻 Online" : "🏫 Face-to-face"}
        </button>))}
    </div>);
}
function BookInner() {
    const s = useStore();
    const q = useSearchParams();
    const id = s.me.id;
    const profile = s.db.tutees.find((t) => t.userId === id);
    const [program, setProgram] = useState(q.get("program") || null);
    if (!profile.complete) {
        return (<>
        <PageHeader title="Book a program"/>
        <Alert kind="warn">
          Please{" "}
          <Link href="/tutee/profile" className="font-bold underline">
            complete your child&apos;s profile
          </Link>{" "}
          first.
        </Alert>
      </>);
    }
    return (<>
      <PageHeader title="Book a program" subtitle={`Booking for ${profile.fullName}${profile.age !== null ? ` (${profile.age} y/o)` : ""} · ${profile.gradeLevel}`}/>
      {!program ? (<div className="grid gap-4 md:grid-cols-3">
          {Object.keys(PROGRAMS).map((k) => (<button key={k} onClick={() => setProgram(k)} className="text-left">
              <Card className="h-full transition hover:border-brand-300 hover:shadow-md">
                <div className="text-4xl">{PROGRAMS[k].emoji}</div>
                <h3 className="mt-2 text-lg font-extrabold">{PROGRAMS[k].name}</h3>
                <p className="mt-1 text-xs font-bold uppercase text-brand-600">{PROGRAMS[k].ages}</p>
                <p className="mt-2 text-sm text-slate-600">{PROGRAMS[k].blurb}</p>
                {k === "playgroup" && <div className="mt-2 text-sm font-bold text-mint-600">{peso(PLAYGROUP_SESSION_RATE)} / session</div>}
              </Card>
            </button>))}
        </div>) : (<>
          <button onClick={() => setProgram(null)} className="mb-4 text-sm font-bold text-brand-600">
            ← All programs
          </button>
          {program === "reading" && <ReadingFlow />}
          {program === "academic" && <AcademicFlow />}
          {program === "playgroup" && <PlaygroupFlow />}
        </>)}
    </>);
}
export default function BookPage() {
    return (<Suspense fallback={<div className="text-slate-400">Loading…</div>}>
      <BookInner />
    </Suspense>);
}
/* ---------------- Academic ---------------- */
function AcademicFlow() {
    const s = useStore();
    const id = s.me.id;
    const profile = s.db.tutees.find((t) => t.userId === id);
    const [subjects, setSubjects] = useState([SUBJECTS[0]]);
    const [grade, setGrade] = useState(gradeChoiceForProfile(profile.gradeLevel));
    const [modality, setModality] = useState("online");
    const [sessionType, setSessionType] = useState("one-on-one");
    const [needs, setNeeds] = useState("");
    const [params, setParams] = useState(null);
    if (params)
        return <TutorialBooking params={params} tuteeId={id} onBack={() => setParams(null)}/>;
    return (<Card className="max-w-2xl space-y-4">
      <h2 className="text-lg font-extrabold">Academic Tutorials</h2>
      <Field label="Subjects">
        <Chips options={SUBJECTS} value={subjects} multi onChange={setSubjects}/>
      </Field>
      <Field label="Grade level">
        <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">Select…</option>
          {GRADE_CHOICES.map((g) => (<option key={g}>{g}</option>))}
        </Select>
      </Field>
      <Field label="Modality">
        <ModalityPicker value={modality} onChange={setModality}/>
      </Field>
      <Field label="Session type">
        <Chips options={["one-on-one", "group"]} value={[sessionType]} onChange={(v) => setSessionType(v[0])}/>
      </Field>
      <Field label="Learning needs / areas of difficulty">
        <Textarea value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder="e.g. struggles with fractions, needs help with reading comprehension…"/>
      </Field>
      <Button disabled={!grade || !subjects.length} onClick={() => setParams({ program: "academic", subject: subjects[0], subjects, gradeLevel: gradeLevelForBooking(grade), modality, sessionType, learningNeeds: needs })}>Proceed to booking & matching</Button>
    </Card>);
}
/* ---------------- Reading ---------------- */
function ReadingFlow() {
    const s = useStore();
    const id = s.me.id;
    const profile = s.db.tutees.find((t) => t.userId === id);
    const mine = s.db.assessments.filter((a) => a.tuteeId === id);
    const booking = [...s.db.bookings].reverse().find((b) => b.tuteeId === id && b.program === "reading" && ["pending", "pending_assessment", "assessment_scheduled", "ready_for_matching", "awaiting_admin", "confirmed"].includes(b.status));
      const awaitingAssessment = booking && ["pending", "pending_assessment", "assessment_scheduled"].includes(booking.status);
    const [params, setParams] = useState(null);
    const [modality, setModality] = useState("online");
    const [needs, setNeeds] = useState("");
    const age = profile.age;
    const ageWarn = age !== null && (age < 3 || age > 15);
    if (params)
        return <TutorialBooking params={params} tuteeId={id} onBack={() => setParams(null)}/>;
    if (booking) {
      const slots = booking.sessionSlots || booking.dates.map((date) => ({ date, subject: "Reading", time: booking.sessionTimes?.[date] ?? booking.time }));
      const linkedAssessment = mine.find((a) => a.id === booking.assessmentId);
      return <div className="max-w-2xl"><Card><h2 className="text-lg font-extrabold">{awaitingAssessment ? "Reading Program request received" : ["awaiting_admin", "ready_for_matching"].includes(booking.status) ? "Assessment completed" : "Reading Program schedule confirmed"}</h2><div className="mt-2"><Badge status={booking.status}>{booking.status === "assessment_scheduled" ? "Initial assessment scheduled" : awaitingAssessment ? linkedAssessment?.status === "booked" ? "Awaiting assessment results" : "Awaiting initial assessment" : undefined}</Badge></div><div className="mt-4 space-y-1 text-sm">{slots.map((slot, index) => <div key={`${slot.date}-${slot.time}-${index}`}>{fmtDate(slot.date)} · {fmtTime(slot.time)}</div>)}</div><div className="mt-3 text-sm font-bold">{slots.length} sessions · {peso(booking.totalFee)}</div><Link href="/tutee/requests" className="mt-4 inline-block"><Button variant="secondary">View pending requests</Button></Link></Card></div>;
    }
    return (<div className="space-y-4">
      <Card>
        <h2 className="text-lg font-extrabold">Reading Programs</h2>
        {ageWarn && <div className="mt-3"><Alert kind="warn">Reading Programs are for ages 3–15; your child is {age}. You can still book — the admin will review.</Alert></div>}
      </Card>
      <Card className="max-w-xl space-y-4">
        <Field label="Modality"><ModalityPicker value={modality} onChange={setModality}/></Field>
        <Field label="Reading goals or areas of concern" hint={`Areas include: ${READING_SKILLS.join(", ")}`}><Textarea value={needs} onChange={(e) => setNeeds(e.target.value)} placeholder="Tell us what your child would like help with…"/></Field>
        <Button disabled={!gradeLevelForBooking(gradeChoiceForProfile(profile.gradeLevel))} onClick={() => setParams({ program: "reading", subject: "Reading", gradeLevel: gradeLevelForBooking(gradeChoiceForProfile(profile.gradeLevel)), modality, learningNeeds: needs })}>Choose schedule</Button>
      </Card>
    </div>);
}
/* ---------------- Playgroup ---------------- */
function PlaygroupFlow() {
    const s = useStore();
    const id = s.me.id;
    const profile = s.db.tutees.find((t) => t.userId === id);
    const [selectedCohortId, setSelectedCohortId] = useState("");
    const [msg, setMsg] = useState(null);
    const months = ageMonths(profile.birthday);
    const eligible = months !== null && months >= 34 && months < 60; // 2.8 – 4.x yrs
    const today = todayISO();
    const cohorts = s.db.cohorts
        .map((c) => ({ c, dates: cohortSessionDates(c).slice().sort() }))
        .filter(({ dates }) => dates[0] >= today)
        .filter(({ c }) => c.modality !== "online" || c.enrolled.includes(id))
        .map((c) => {
          const active = s.db.bookings.filter((b) => b.program === "playgroup" && b.cohortId === c.c.id && ["pending", "approved", "confirmed", "awaiting_admin"].includes(b.status));
          return { ...c, left: Math.max(0, 6 - active.length), active };
        });
    const selectedCohort = cohorts.find(({ c }) => c.id === selectedCohortId) || cohorts.find((cohort) => cohort.left > 0) || cohorts[0];
    const alreadyReserved = selectedCohort?.active.some((booking) => booking.tuteeId === id);
    const book = async () => {
        const r = await s.bookPlaygroup(id, selectedCohort.c.id);
        setMsg(r.ok ? { kind: "success", text: "Booking submitted. It is pending administrator approval; tutor assignment may still be pending." } : { kind: "error", text: r.error });
    };
    return (<div className="space-y-4">
      <Card>
        <h2 className="text-lg font-extrabold">Playgroup cohort</h2>
        <p className="mt-1 text-sm text-slate-600">Reserve one slot in a six-student cohort. The slot covers all 12 Monday, Wednesday and Friday sessions over four weeks.</p>
        {!eligible && (<div className="mt-3">
            <Alert kind="warn">
              {months === null ? "Add your child's birthday in the profile to check eligibility." : `Playgroup is for ages 2.8–4. Your child is ${(months / 12).toFixed(1)} years old, so booking is disabled.`}
            </Alert>
          </div>)}
      </Card>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {cohorts.length === 0 ? <Card><p className="text-sm text-slate-500">There are no upcoming cohorts open for booking. The admin will post the next cohort when its start week is scheduled.</p></Card> : <div className="grid items-start gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div>
            <h3 className="font-extrabold">Cohort dates</h3>
            <p className="text-xs text-slate-500">All 12 dates in the selected cohort are highlighted.</p>
          </div>
          <Calendar selected={selectedCohort?.dates || []} initialMonth={selectedCohort?.dates[0] || today} readOnly mark={(date) => selectedCohort?.dates.includes(date) ? { text: "Playgroup", tone: "mint" } : null}/>
          {selectedCohort && <p className="text-sm font-bold">{fmtDate(selectedCohort.dates[0])}–{fmtDate(selectedCohort.dates[selectedCohort.dates.length - 1])} · {selectedCohort.dates.length} sessions</p>}
        </Card>
        <div className="space-y-3">
          <h3 className="font-extrabold">Choose a cohort</h3>
          {cohorts.map(({ c, dates, left, active }) => {
            const enrolled = active.some((booking) => booking.tuteeId === id);
            const selected = c.id === selectedCohort?.c.id;
            return <button key={c.id} type="button" onClick={() => { setSelectedCohortId(c.id); setMsg(null); }} className="block w-full text-left">
              <Card className={`!p-4 ${selected ? "border-brand-300 ring-2 ring-brand-100" : "hover:border-brand-200"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-extrabold">{c.label}</div>
                    <div className="mt-1 text-xs text-slate-500">{fmtDate(dates[0])}–{fmtDate(dates[dates.length - 1])} · 12 sessions · Mon/Wed/Fri · {fmtTime(c.time || "10:00")}</div>
                  </div>
                  {enrolled ? <Badge status="confirmed">Already reserved</Badge> : left > 0 ? <Badge status="approved">{left} slots available</Badge> : <Badge status="rejected">Full</Badge>}
                </div>
              </Card>
            </button>;
          })}
          {selectedCohort && <Button disabled={!eligible || alreadyReserved || selectedCohort.left <= 0} onClick={book}>{alreadyReserved ? "Slot already reserved" : "Reserve a slot"}</Button>}
        </div>
      </div>
      }
    </div>);
}

"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Calendar } from "@/components/Calendar";
import { TutorialBooking } from "@/components/TutorialBooking";
import { Alert, Badge, Button, Card, Chips, Field, PageHeader, Select, Textarea, cn, peso } from "@/components/ui";
import { ASSESSMENT_FEE, GRADE_LEVELS, HOURS, PLAYGROUP_MONTHLY_FEE, PROGRAMS, READING_SKILLS, SUBJECTS } from "@/lib/constants";
import { addDays, fmtDate, fmtTime, parseISO, todayISO, weekday } from "@/lib/dates";
import { cohortSessionDates, slotOccupied } from "@/lib/logic";
import { useStore } from "@/lib/store";
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
                <p className="text-xs font-bold uppercase text-brand-600">{PROGRAMS[k].ages}</p>
                <p className="mt-2 text-sm text-slate-600">{PROGRAMS[k].blurb}</p>
                {k === "playgroup" && <p className="mt-2 text-sm font-bold text-mint-600">{peso(PLAYGROUP_MONTHLY_FEE)} / month</p>}
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
    const [subject, setSubject] = useState(SUBJECTS[0]);
    const [grade, setGrade] = useState(profile.gradeLevel || "Grade 1");
    const [modality, setModality] = useState("online");
    const [sessionType, setSessionType] = useState("one-on-one");
    const [needs, setNeeds] = useState("");
    const [params, setParams] = useState(null);
    if (params)
        return <TutorialBooking params={params} tuteeId={id} onBack={() => setParams(null)}/>;
    return (<Card className="max-w-2xl space-y-4">
      <h2 className="text-lg font-extrabold">Academic Tutorials</h2>
      <Field label="Subject">
        <Chips options={SUBJECTS} value={[subject]} onChange={(v) => setSubject(v[0])}/>
      </Field>
      <Field label="Grade level">
        <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
          {GRADE_LEVELS.map((g) => (<option key={g}>{g}</option>))}
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
      <Button onClick={() => setParams({ program: "academic", subject, gradeLevel: grade, modality, sessionType, learningNeeds: needs })}>Proceed to booking & matching</Button>
    </Card>);
}
/* ---------------- Reading ---------------- */
function ReadingFlow() {
    const s = useStore();
    const id = s.me.id;
    const profile = s.db.tutees.find((t) => t.userId === id);
    const mine = s.db.assessments.filter((a) => a.tuteeId === id);
    const booked = mine.find((a) => a.status === "booked");
    const done = [...mine].reverse().find((a) => a.status === "completed");
    const [params, setParams] = useState(null);
    const [modality, setModality] = useState("online");
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [err, setErr] = useState("");
    const [ok, setOk] = useState(false);
    const [skill, setSkill] = useState([]);
    const age = profile.age;
    const ageWarn = age !== null && (age < 3 || age > 15);
    if (params)
        return <TutorialBooking params={params} tuteeId={id} onBack={() => setParams(null)}/>;
    if (done) {
        return (<div className="max-w-2xl space-y-4">
        <Card>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-mint-500"/>
            <h2 className="text-lg font-extrabold">Assessment completed</h2>
          </div>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs font-bold uppercase text-slate-400">Reading level</dt><dd>{done.readingLevel}</dd></div>
            <div><dt className="text-xs font-bold uppercase text-slate-400">Results</dt><dd>{done.results}</dd></div>
            <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-slate-400">Learning needs</dt><dd>{done.learningNeeds}</dd></div>
          </dl>
        </Card>
        <Card className="space-y-4">
          <h3 className="font-extrabold">Proceed to tutorial booking & matching</h3>
          <Field label="Modality">
            <ModalityPicker value={modality} onChange={setModality}/>
          </Field>
          <Button onClick={() => setParams({ program: "reading", subject: "Reading", gradeLevel: profile.gradeLevel, modality, learningNeeds: done.learningNeeds || "", assessmentId: done.id })}>Choose schedule</Button>
        </Card>
      </div>);
    }
    if (booked) {
        return (<Card className="max-w-2xl">
        <h2 className="text-lg font-extrabold">Assessment booked ✅</h2>
        <p className="mt-2 text-sm">
          {fmtDate(booked.date)} at <b>{fmtTime(booked.time)}</b> <Badge status={booked.modality}/>
        </p>
        <p className="mt-2 text-sm text-slate-500">After the admin records your assessment results and learning needs, you can proceed to tutorial booking and matching.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={() => s.cancelAssessment(booked.id)}>
          Cancel assessment
        </Button>
      </Card>);
    }
    const slotOk = (d, t) => !slotOccupied(s.db, d, t);
    const slots = HOURS.filter((h) => h !== "17:00");
    const dayOpen = (d) => weekday(d) !== 0 && slots.some((t) => slotOk(d, t));
    return (<div className="space-y-4">
      <Card>
        <h2 className="text-lg font-extrabold">Reading Programs</h2>
        <p className="mt-1 text-sm text-slate-500">Step 1: book an initial assessment ({peso(ASSESSMENT_FEE)}). The admin records results and learning needs, then you proceed to matching.</p>
        <p className="mt-2 text-xs text-slate-400">Covers: {READING_SKILLS.join(" · ")}</p>
        {ageWarn && <div className="mt-3"><Alert kind="warn">Reading Programs are for ages 3–15; your child is {age}. You can still book — the admin will review.</Alert></div>}
      </Card>
      {ok ? (<Alert kind="success">Assessment booked! Check Pending Requests for details.</Alert>) : (<div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <Field label="Modality">
              <ModalityPicker value={modality} onChange={(m) => { setModality(m); setTime(""); }}/>
            </Field>
            <Field label="Select an available date">
              <Calendar selected={date ? [date] : []} onSelect={(d) => { setDate(d); setTime(""); }} isDisabled={(d) => d <= todayISO() || !dayOpen(d)} mark={(d) => (d > todayISO() && dayOpen(d) ? { text: "open", tone: "mint" } : null)}/>
            </Field>
          </div>
          <div className="space-y-4">
            <Field label="Select a time">
              {date ? (<div className="grid grid-cols-3 gap-2">
                  {slots.map((t) => {
                    const free = slotOk(date, t);
                    return (<button key={t} disabled={!free} onClick={() => setTime(t)} className={cn("rounded-xl border p-2 text-sm font-bold", time === t ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200", !free && "cursor-not-allowed text-slate-300 line-through")}>
                        {fmtTime(t)}
                      </button>);
                })}
                </div>) : (<p className="text-sm text-slate-400">Pick a date first.</p>)}
            </Field>
            {date && time && (<Card className="space-y-3 bg-slate-50 !shadow-none">
                <p className="text-sm">
                  {fmtDate(date)} · {fmtTime(time)} · {modality}
                </p>
                {err && <Alert kind="error">{err}</Alert>}
                <Button onClick={async () => {
                    const r = await s.bookAssessment(id, modality, date, time);
                    if (!r.ok)
                        return setErr(r.error);
                    setOk(true);
                }}>
                  Submit assessment booking
                </Button>
              </Card>)}
          </div>
        </div>)}
      <input type="hidden" value={skill.join(",")} readOnly/>
    </div>);
}
/* ---------------- Playgroup ---------------- */
function PlaygroupFlow() {
    const s = useStore();
    const id = s.me.id;
    const profile = s.db.tutees.find((t) => t.userId === id);
    const [date, setDate] = useState("");
    const [msg, setMsg] = useState(null);
    const months = ageMonths(profile.birthday);
    const eligible = months !== null && months >= 34 && months < 60; // 2.8 – 4.x yrs
    const today = todayISO();
    const cohorts = s.db.cohorts
        .filter((c) => cohortSessionDates(c)[cohortSessionDates(c).length - 1] >= today)
        .filter((c) => c.modality !== "online" || c.enrolled.includes(id))
        .map((c) => ({ c, dates: cohortSessionDates(c), left: c.capacity - c.enrolled.length }));
    const allDates = new Set(cohorts.flatMap((x) => x.dates));
    const onDate = cohorts.filter((x) => (date ? x.dates.includes(date) : true));
    const alternatives = cohorts.filter((x) => x.left > 0);
    const book = async (cid) => {
        const r = await s.bookPlaygroup(id, cid);
        setMsg(r.ok ? { kind: "success", text: "Slot reserved! Booking confirmation sent." } : { kind: "error", text: r.error });
    };
    return (<div className="space-y-4">
      <Card>
        <h2 className="text-lg font-extrabold">Playgroup Class</h2>
        <p className="mt-1 text-sm text-slate-500">1 month · 3× a week · {peso(PLAYGROUP_MONTHLY_FEE)} · Ages 2.8–4. Pick a date on the calendar to see classes running that day and their remaining slots.</p>
        {!eligible && (<div className="mt-3">
            <Alert kind="warn">
              {months === null ? "Add your child's birthday in the profile to check eligibility." : `Playgroup is for ages 2.8–4. Your child is ${(months / 12).toFixed(1)} years old, so booking is disabled.`}
            </Alert>
          </div>)}
      </Card>
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        <Calendar selected={date ? [date] : []} onSelect={(d) => setDate(date === d ? "" : d)} isDisabled={(d) => !allDates.has(d)} mark={(d) => {
            const n = cohorts.filter((x) => x.dates.includes(d));
            if (!n.length)
                return null;
            const left = n.reduce((a, x) => a + Math.max(0, x.left), 0);
            return { text: left ? `${left} left` : "full", tone: left ? "mint" : "coral" };
        }}/>
        <div className="space-y-3">
          <p className="text-sm font-bold">{date ? `Classes on ${fmtDate(date)}` : "All upcoming classes"}</p>
          {onDate.length === 0 && <p className="text-sm text-slate-400">No classes.</p>}
          {onDate.map(({ c, dates, left }) => {
            const enrolled = c.enrolled.includes(id);
            return (<Card key={c.id} className="!p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-extrabold">{c.label}</div>
                    <div className="text-xs text-slate-500">
                      {fmtTime(c.time)} · {c.modality ?? "face-to-face"} · {c.weekdays.map((w) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w]).join("/")} · {fmtDate(dates[0])} → {fmtDate(dates[dates.length - 1])}
                    </div>
                    <div className="mt-1 text-xs">
                      Capacity: {c.enrolled.length}/{c.capacity}
                    </div>
                  </div>
                  {enrolled ? <Badge status="confirmed">Enrolled</Badge> : left > 0 ? <Badge status="approved">{left} slot(s) left</Badge> : <Badge status="rejected">Full</Badge>}
                </div>
                {!enrolled && (<Button size="sm" className="mt-3" disabled={left <= 0 || !eligible} onClick={() => book(c.id)}>
                    Submit class booking
                  </Button>)}
              </Card>);
        })}
          {onDate.some((x) => x.left <= 0) && alternatives.length > 0 && (<Alert kind="warn">
              Full class? Alternative available schedules: {alternatives.map((a) => `${a.c.label} (${a.left} left)`).join(" · ")}
              <br />
              <button className="mt-1 font-bold underline" onClick={() => setDate("")}>
                Show all classes
              </button>
            </Alert>)}
        </div>
      </div>
      <span className="hidden">{addDays(today, 0)}</span>
    </div>);
}

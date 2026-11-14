"use client";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Select, Tabs, Textarea } from "@/components/ui";
import { SlidersHorizontal } from "lucide-react";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { downloadPdfDataUrl } from "@/lib/files";
import { useStore } from "@/lib/store";
import { SUBJECTS } from "@/lib/constants";
const TUTOR_GRADE_CHOICES = ["Nursery", "Preschool", "Kinder", "Elementary", "High School"];
const FILTER_STATUSES = [
  { label: "Active", value: "active" },
  { label: "Pending", value: "pending" },
  { label: "Rejected", value: "rejected" },
];
export default function Applications() {
    const s = useStore();
    const [tab, setTab] = useState("new");
    const [interview, setInterview] = useState(null);
    const [reject, setReject] = useState(null);
    const [when, setWhen] = useState("");
    const [notes, setNotes] = useState("Please bring valid ID and your teaching credentials.");
    const [reason, setReason] = useState("");
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [draftSubjects, setDraftSubjects] = useState([]);
    const [draftGrades, setDraftGrades] = useState([]);
    const [draftStatuses, setDraftStatuses] = useState([]);
    const [filters, setFilters] = useState({ subjects: [], grades: [], statuses: [] });
    const [sort, setSort] = useState("name");
    const tutors = s.db.tutors;
    const newApps = tutors.filter((t) => t.applicantType === "new" && ["pending_review", "interview"].includes(t.status));
    const existing = tutors.filter((t) => t.status === "pending_verification");
    const email = (id) => s.db.users.find((u) => u.id === id)?.email;
    const tabList = tab === "new" ? newApps : tab === "existing" ? existing : tutors;
    const list = useMemo(() => tabList.filter((t) => {
      const query = search.trim().toLowerCase();
      const searchable = [t.fullName, email(t.userId), t.contact, t.bio, ...(t.subjects ?? []), ...(t.gradeBands ?? [])].join(" ").toLowerCase();
      const statusGroup = t.status === "active" ? "active" : t.status === "rejected" ? "rejected" : "pending";
      return (!query || searchable.includes(query))
        && (!filters.subjects.length || filters.subjects.some((value) => t.subjects?.includes(value)))
        && (!filters.grades.length || filters.grades.some((value) => {
          if (["Nursery", "Preschool", "Kinder"].includes(value)) return t.gradeBands?.includes("Preschool");
          if (value === "High School") return t.gradeBands?.some((band) => ["Junior High", "Senior High"].includes(band));
          return t.gradeBands?.includes(value);
        }))
        && (!filters.statuses.length || filters.statuses.includes(statusGroup));
    }).sort((a, b) => {
      if (sort === "verified_newest") return new Date(b.verifiedAt ?? 0) - new Date(a.verifiedAt ?? 0);
      if (sort === "verified_oldest") return new Date(a.verifiedAt ?? 0) - new Date(b.verifiedAt ?? 0);
      return a.fullName.localeCompare(b.fullName);
    }), [tabList, search, filters, sort]);
    const availableSubjects = [...SUBJECTS, "Reading"];
    const activeFilterCount = filters.subjects.length + filters.grades.length + filters.statuses.length;
    const draftFilterCount = draftSubjects.length + draftGrades.length + draftStatuses.length;
    const toggleValue = (value, values, setter) => setter(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
    return (<>
      <PageHeader title="Tutor applications & verifications" subtitle="Review resumes, schedule interviews, approve or reject accounts."/>
      <Tabs tabs={[
            { id: "new", label: "New applicants", count: newApps.length },
            { id: "existing", label: "Existing tutor verification", count: existing.length },
            { id: "all", label: "All tutors" },
        ]} value={tab} onChange={setTab}/>
      <div className="my-4 flex flex-wrap items-start justify-between gap-3">
        <Input aria-label="Search tutors" className="max-w-sm" placeholder="Search name, email, subject…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <div className="relative">
          <button type="button" onClick={() => { setDraftSubjects(filters.subjects); setDraftGrades(filters.grades); setDraftStatuses(filters.statuses); setFilterOpen((open) => !open); }} className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" aria-expanded={filterOpen}>
            <SlidersHorizontal className="h-4 w-4 text-brand-600"/> Filters{activeFilterCount > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">{activeFilterCount}</span>}
          </button>
          {filterOpen && <div className="absolute right-0 z-20 mt-2 w-[320px] rounded-2xl border border-slate-100 bg-white p-4 shadow-xl">
            <div className="mb-3">
              <h3 className="mb-1 text-sm font-bold">Subject</h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">{availableSubjects.map((value) => <label key={value} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={draftSubjects.includes(value)} onChange={() => toggleValue(value, draftSubjects, setDraftSubjects)}/>{value}</label>)}</div>
            </div>
            <div className="mb-3">
              <h3 className="mb-1 text-sm font-bold">Grade Bands</h3>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1">{TUTOR_GRADE_CHOICES.map((value) => <label key={value} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={draftGrades.includes(value)} onChange={() => toggleValue(value, draftGrades, setDraftGrades)}/>{value}</label>)}</div>
            </div>
            <div className="mb-4">
              <h3 className="mb-1 text-sm font-bold">Status</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-1">{FILTER_STATUSES.map(({ label, value }) => <label key={value} className="flex items-center gap-1.5 text-xs"><input type="checkbox" checked={draftStatuses.includes(value)} onChange={() => toggleValue(value, draftStatuses, setDraftStatuses)}/>{label}</label>)}</div>
            </div>
            <div className="mb-3 flex items-center gap-2 text-xs"><span className="font-bold">Sort:</span><Select aria-label="Sort tutors" className="py-1.5" value={sort} onChange={(e) => setSort(e.target.value)}><option value="name">Name</option><option value="verified_newest">Verified: Newest</option><option value="verified_oldest">Verified: Oldest</option></Select></div>
            <div className="flex justify-between gap-3 border-t border-slate-100 pt-3">
              <Button size="sm" variant="secondary" onClick={() => { setDraftSubjects([]); setDraftGrades([]); setDraftStatuses([]); setFilters({ subjects: [], grades: [], statuses: [] }); }}>Clear All ({draftFilterCount})</Button>
              <Button size="sm" onClick={() => { setFilters({ subjects: draftSubjects, grades: draftGrades, statuses: draftStatuses }); setFilterOpen(false); }}>Apply</Button>
            </div>
          </div>}
        </div>
      </div>
      {list.length === 0 ? (<Empty>Nothing to review.</Empty>) : (<div className="grid gap-4 md:grid-cols-2">
          {list.map((t) => (<Card key={t.userId} className="space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-extrabold">{t.fullName}</div>
                  <div className="text-xs text-slate-500">{email(t.userId)} · {t.contact} · {t.age ? `${t.age} y/o` : ""}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge status={t.status}/>
                  <span className="text-[10px] font-bold uppercase text-slate-400">{t.applicantType === "new" ? "New applicant" : "Existing tutor"}</span>
                </div>
              </div>
              <div className="text-sm"><b>Subjects:</b> {t.subjects.join(", ")}</div>
              <div className="text-sm"><b>Grade bands:</b> {t.gradeBands.join(", ")}</div>
              {t.applicantType !== "existing" && t.bio && <p className="text-sm text-slate-600">{t.bio}</p>}
              {t.status === "active" && <div className="text-sm"><b>Date Verified:</b> {t.verifiedAt ? fmtDate(t.verifiedAt.slice(0, 10)) : "Not recorded"}</div>}
              {t.applicantType !== "existing" && <div className="text-sm">
                <b>Resume:</b>{" "}
                {t.resumeData ? (<button className="font-bold text-brand-600 underline" onClick={() => {
                    if (!downloadPdfDataUrl(t.resumeName, t.resumeData)) {
                        window.alert("This resume is not a valid PDF and cannot be downloaded.");
                    }
                }}>{t.resumeName}</button>) : (<span className="text-slate-500">{t.resumeName || "not provided"}</span>)}
              </div>}
              {t.status === "interview" && t.interviewAt && <Alert kind="info">Interview: {fmtDateTime(t.interviewAt)}</Alert>}
              {t.rejectionReason && <Alert kind="error">{t.rejectionReason}</Alert>}
              <div className="flex flex-wrap gap-2 pt-1">
                {t.status === "pending_review" && (<>
                    <Button size="sm" onClick={() => setInterview(t)}>Schedule interview</Button>
                    <Button size="sm" variant="danger" onClick={() => setReject(t)}>Reject</Button>
                  </>)}
                {t.status === "interview" && (<>
                    <Button size="sm" variant="success" onClick={() => s.evaluateApplicant(t.userId, true)}>Accept & activate</Button>
                    <Button size="sm" variant="secondary" onClick={() => setInterview(t)}>Reschedule</Button>
                    <Button size="sm" variant="danger" onClick={() => setReject(t)}>Reject</Button>
                  </>)}
                {t.status === "pending_verification" && (<>
                    <Button size="sm" variant="success" onClick={() => s.verifyExistingTutor(t.userId, true)}>Verify & activate</Button>
                    <Button size="sm" variant="danger" onClick={() => setReject(t)}>Reject / request corrections</Button>
                  </>)}
                {t.status === "rejected" && (<Button size="sm" variant="secondary" onClick={() => s.verifyExistingTutor(t.userId, true)}>Reactivate</Button>)}
                {t.status === "active" && (<Button size="sm" variant="secondary" onClick={() => setReject(t)}>Deactivate</Button>)}
              </div>
            </Card>))}
        </div>)}

      <Modal open={!!interview} onClose={() => setInterview(null)} title={`Interview: ${interview?.fullName}`}>
        <div className="space-y-4">
          <Field label="Date & time">
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}/>
          </Field>
          <Field label="Instructions">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}/>
          </Field>
          <Button disabled={!when} onClick={() => {
            s.scheduleInterview(interview.userId, new Date(when).toISOString(), notes);
            setInterview(null);
            setWhen("");
        }}>
            Schedule & notify applicant
          </Button>
        </div>
      </Modal>
      <Modal open={!!reject} onClose={() => setReject(null)} title={`Reject / deactivate: ${reject?.fullName}`}>
        <div className="space-y-4">
          <Field label="Reason / corrections needed">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)}/>
          </Field>
          <Button variant="danger" onClick={() => {
            s.evaluateApplicant(reject.userId, false, reason);
            setReject(null);
            setReason("");
        }}>
            Confirm & notify
          </Button>
        </div>
      </Modal>
    </>);
}

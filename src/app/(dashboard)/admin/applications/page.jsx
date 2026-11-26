"use client";
import { useCallback, useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, FilterPopover, FilterTrigger, Input, Modal, PageHeader, Tabs, Textarea } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { openPdfDataUrl } from "@/lib/files";
import { useStore } from "@/lib/store";
export default function Applications({ embedded = false } = {}) {
    const s = useStore();
    const [tab, setTab] = useState("new");
    const [interview, setInterview] = useState(null);
    const [reject, setReject] = useState(null);
    const [when, setWhen] = useState("");
    const [notes, setNotes] = useState("Please bring valid ID and your teaching credentials.");
    const [reason, setReason] = useState("");
    const [search, setSearch] = useState("");
    const [filterOpen, setFilterOpen] = useState(false);
    const [sort, setSort] = useState("name-asc");
    const tutors = s.db.tutors;
    const newApps = tutors.filter((t) => t.applicantType === "new" && ["pending_review", "interview"].includes(t.status));
    const existing = tutors.filter((t) => t.status === "pending_verification");
    const email = useCallback((id) => s.db.users.find((u) => u.id === id)?.email, [s.db.users]);
    const tabList = tab === "new" ? newApps : tab === "existing" ? existing : tutors;
    const list = useMemo(() => [...tabList].sort((a, b) => {
      if (sort === "name-asc" || sort === "name-desc") {
        const result = String(a.fullName || "").localeCompare(String(b.fullName || ""), undefined, { sensitivity: "base" });
        return sort === "name-asc" ? result : -result;
      }
      const createdAt = (tutor) => s.db.users.find((user) => user.id === tutor.userId)?.createdAt || tutor.createdAt || "";
      const result = String(createdAt(a)).localeCompare(String(createdAt(b)));
      return sort === "oldest" ? result : -result;
    }).filter((t) => {
      const query = search.trim().toLowerCase();
      const searchable = [t.fullName, email(t.userId), t.contact, t.bio, ...(t.subjects ?? []), ...(t.gradeBands ?? [])].join(" ").toLowerCase();
      return !query || searchable.includes(query);
    }), [tabList, search, sort, email, s.db.users]);
    return (<>
      {!embedded && <PageHeader title="Tutor applications & verifications" subtitle="Review resumes, schedule interviews, approve or reject accounts."/>}
      <Tabs tabs={[
            { id: "new", label: "New applicants", count: newApps.length },
            { id: "existing", label: "Existing tutor verification", count: existing.length },
            { id: "all", label: "All tutors" },
        ]} value={tab} onChange={setTab}/>
      <div className="my-4 flex flex-wrap items-start justify-between gap-3">
        <Input aria-label="Search tutors" className="max-w-sm" placeholder="Search name, email, subject…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        <div className="relative">
          <FilterTrigger onClick={() => setFilterOpen((open) => !open)} ariaLabel="Sort tutor applications" expanded={filterOpen} count={sort !== "name-asc" ? 1 : 0}/>
          {filterOpen && <FilterPopover onClear={() => setSort("name-asc")} onCancel={() => setFilterOpen(false)} onApply={() => setFilterOpen(false)}>
            <fieldset><legend className="mb-2 text-xs font-extrabold text-slate-700">Sort by</legend><div className="grid grid-cols-2 gap-1">{[["name-asc", "Name: A to Z"], ["name-desc", "Name: Z to A"], ["newest", "Newest"], ["oldest", "Oldest"]].map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-700 hover:bg-brand-50"><input type="radio" name="tutor-application-sort" checked={sort === value} onChange={() => setSort(value)} className="accent-brand-600"/>{label}</label>)}</div></fieldset>
          </FilterPopover>}
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
                    if (!openPdfDataUrl(t.resumeData)) {
                        window.alert("This resume could not be previewed. Please allow pop-ups and try again.");
                    }
                }}>Preview {t.resumeName || "resume PDF"}</button>) : (<span className="text-slate-500">{t.resumeName || "not provided"}</span>)}
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

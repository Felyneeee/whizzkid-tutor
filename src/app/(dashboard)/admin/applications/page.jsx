"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, Field, Input, Modal, PageHeader, Tabs, Textarea } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { downloadPdfDataUrl } from "@/lib/files";
import { useStore } from "@/lib/store";
export default function Applications() {
    const s = useStore();
    const [tab, setTab] = useState("new");
    const [interview, setInterview] = useState(null);
    const [reject, setReject] = useState(null);
    const [when, setWhen] = useState("");
    const [notes, setNotes] = useState("Please bring valid ID and your teaching credentials.");
    const [reason, setReason] = useState("");
    const tutors = s.db.tutors;
    const newApps = tutors.filter((t) => t.applicantType === "new" && ["pending_review", "interview"].includes(t.status));
    const existing = tutors.filter((t) => t.status === "pending_verification");
    const list = tab === "new" ? newApps : tab === "existing" ? existing : tutors;
    const email = (id) => s.db.users.find((u) => u.id === id)?.email;
    return (<>
      <PageHeader title="Tutor applications & verifications" subtitle="Review resumes, schedule interviews, approve or reject accounts."/>
      <Tabs tabs={[
            { id: "new", label: "New applicants", count: newApps.length },
            { id: "existing", label: "Existing tutor verification", count: existing.length },
            { id: "all", label: "All tutors" },
        ]} value={tab} onChange={setTab}/>
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
              {t.bio && <p className="text-sm text-slate-600">{t.bio}</p>}
              <div className="text-sm">
                <b>Resume:</b>{" "}
                {t.resumeData ? (<button className="font-bold text-brand-600 underline" onClick={() => {
                    if (!downloadPdfDataUrl(t.resumeName, t.resumeData)) {
                        window.alert("This resume is not a valid PDF and cannot be downloaded.");
                    }
                }}>{t.resumeName}</button>) : (<span className="text-slate-500">{t.resumeName || "not provided"}</span>)}
              </div>
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

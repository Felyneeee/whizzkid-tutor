"use client";
import { useState } from "react";
import { Alert, Button, Field, Input, Select, Textarea } from "@/components/ui";
import { useStore } from "@/lib/store";
const STATUS_LABELS = {
    not_started: "Not started",
    practicing: "Practicing",
    mastered: "Mastered",
};
export function SessionProgressForm({ sessionId, defaultSubject, existing }) {
    const store = useStore();
    const [form, setForm] = useState({
        subject: existing?.subject ?? defaultSubject,
        skill: existing?.skill ?? "",
        learningGoal: existing?.learningGoal ?? "",
        status: existing?.status ?? "practicing",
        evidence: existing?.evidence ?? "",
        score: existing?.score == null ? "" : String(existing.score),
        nextStep: existing?.nextStep ?? "",
    });
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        setError("");
        setMessage("");
        const score = form.score.trim() === "" ? null : Number(form.score);
        if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) {
            setError("Enter a whole-number mastery check score from 0 to 100, or leave it blank.");
            return;
        }
        setSaving(true);
        const result = await store.submitProgressReport(sessionId, { ...form, score });
        setSaving(false);
        if (!result.ok)
            return setError(result.error);
        setMessage("Progress report saved.");
    };
    return (<details className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
      <summary className="cursor-pointer text-sm font-bold text-brand-700">
        {existing ? "Edit progress report" : "Add learning progress"}
      </summary>
      <form className="mt-3 grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <Field label="Subject"><Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}/></Field>
        <Field label="Skill or topic"><Input required placeholder="e.g. equivalent fractions" value={form.skill} onChange={(e) => setForm({ ...form, skill: e.target.value })}/></Field>
        <Field label="Learning goal"><Input required placeholder="What should the student learn?" value={form.learningGoal} onChange={(e) => setForm({ ...form, learningGoal: e.target.value })}/></Field>
        <Field label="Progress status"><Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
        <Field label="Evidence of learning"><Textarea required placeholder="e.g. solved 4 of 5 questions independently" value={form.evidence} onChange={(e) => setForm({ ...form, evidence: e.target.value })}/></Field>
        <Field label="Mastery check score (%)" hint="Optional. Use a score from an assessment or mastery check."><Input type="number" min="0" max="100" step="1" placeholder="e.g. 80" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })}/></Field>
        <Field label="Next step"><Textarea required placeholder="What should be practiced next?" value={form.nextStep} onChange={(e) => setForm({ ...form, nextStep: e.target.value })}/></Field>
        {error && <div className="sm:col-span-2"><Alert kind="error">{error}</Alert></div>}
        {message && <div className="sm:col-span-2"><Alert kind="success">{message}</Alert></div>}
        <div className="sm:col-span-2"><Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save progress report"}</Button></div>
      </form>
    </details>);
}

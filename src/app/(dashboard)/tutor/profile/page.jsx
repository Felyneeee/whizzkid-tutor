"use client";

import Image from "next/image";
import { BookOpen, Check, CloudUpload, FileText, GraduationCap, Pencil, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Chips, Field, Input } from "@/components/ui";
import { SUBJECTS } from "@/lib/constants";
import { ageFromBirthday } from "@/lib/dates";
import { openPdfDataUrl, readFileAsDataURL, readPdfAsDataURL } from "@/lib/files";
import { useStore } from "@/lib/store";

const GRADE_CHOICES = ["Nursery", "Preschool", "Kinder", "Elementary", "High School"];
const choicesForGradeBands = (bands = []) => bands.flatMap((band) => {
  if (band === "Preschool") return ["Preschool"];
  if (band === "Junior High") return ["High School"];
  return GRADE_CHOICES.includes(band) ? [band] : [];
});

function Avatar({ photo, large = false }) {
  return <div className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-[#dce2f0] text-slate-400 ${large ? "h-40 w-40" : "h-32 w-32"}`}>
    {photo ? <Image src={photo} alt="Tutor profile" fill unoptimized className="object-cover"/> : <UserRound className="h-20 w-20 fill-[#a5a9b3] stroke-[#a5a9b3]" aria-hidden="true"/>}
  </div>;
}

function InfoPanel({ title, icon: Icon, values }) {
  return <section className="rounded-2xl border-2 border-blue-600 bg-white px-6 py-5 sm:px-8">
    <div className="flex items-center gap-4 text-[#5d5b5a]"><Icon className="h-8 w-8 shrink-0 text-blue-600"/><h2 className="text-xl font-bold">{title}</h2></div>
    <div className="ml-12 mt-3 h-1.5 w-32 rounded-full bg-blue-600"/>
    <div className="ml-12 mt-5 flex flex-wrap gap-2">
      {values.length ? values.map((value) => <span key={value} className="min-w-28 rounded-full bg-[#c9def9] px-5 py-2 text-center text-sm font-bold text-blue-600">{value}</span>) : <span className="text-sm text-slate-400">Not added</span>}
    </div>
  </section>;
}

export default function TutorProfilePage() {
  const s = useStore();
  const id = s.me.id;
  const t = s.db.tutors.find((x) => x.userId === id);
  const [f, setF] = useState({ fullName: t.fullName, age: String(t.age ?? ""), contact: t.contact || "", birthday: t.birthday || "" });
  const [subjects, setSubjects] = useState(t.subjects || []);
  const [bands, setBands] = useState(() => choicesForGradeBands(t.gradeBands));
  const [photo, setPhoto] = useState(t.photo || "");
  const [resume, setResume] = useState({ name: t.resumeName || "", data: t.resumeData || "" });
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedModal, setSavedModal] = useState(false);
  const set = (k) => (e) => setF((previous) => ({ ...previous, [k]: e.target.value }));

  const up = async (file, kind) => {
    if (!file) return;
    try {
      const data = kind === "photo" ? await readFileAsDataURL(file) : await readPdfAsDataURL(file);
      if (kind === "photo") setPhoto(data);
      else setResume({ name: file.name, data });
    } catch (e) {
      setMsg({ kind: "error", text: e.message });
    }
  };

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const result = await s.saveTutorProfile(id, { fullName: f.fullName, age: f.age ? Number(f.age) : null, contact: f.contact, birthday: f.birthday || undefined, subjects, gradeBands: [...new Set(bands)], photo, resumeName: resume.name, resumeData: resume.data });
      if (!result?.ok) throw new Error(result?.error || "Profile could not be saved. Please try again.");
      setEditing(false);
      setSavedModal(true);
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Profile could not be saved. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const formattedBirthday = f.birthday ? new Date(`${f.birthday}T00:00:00`).toLocaleDateString("en-US") : "Not provided";
  const age = f.birthday ? ageFromBirthday(f.birthday) : f.age;

  return <div className="mx-auto max-w-5xl pb-10">
    <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-black">Profile</h1>

    {editing ? <section className="relative mt-28 rounded-2xl bg-white px-6 pb-6 pt-6 shadow-sm sm:px-12">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2"><Avatar photo={photo} large/><label className="absolute -bottom-1 -right-1 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-white text-slate-600 shadow" aria-label="Change profile photo"><Pencil className="h-5 w-5"/><input className="sr-only" type="file" accept="image/*" onChange={(e) => up(e.target.files?.[0], "photo")}/></label></div>
      <div className="mb-8 hidden justify-end sm:flex"><Button disabled={saving} onClick={save} className="min-w-44 rounded-2xl bg-blue-600 hover:bg-blue-700">{saving ? "Saving…" : "Save Profile"}</Button></div>
      <div className="mb-6 mt-14 flex justify-center sm:hidden"><Button disabled={saving} onClick={save} className="min-w-44 rounded-2xl bg-blue-600 hover:bg-blue-700">{saving ? "Saving…" : "Save Profile"}</Button></div>
      <div className="border-l-4 border-slate-100 pl-5 sm:pl-6">
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={f.fullName} onChange={set("fullName")} className="rounded-2xl py-3"/></Field>
          <Field label="Age"><Input type="number" value={f.age} onChange={set("age")} className="rounded-2xl py-3"/></Field>
          <Field label="Contact"><Input value={f.contact} onChange={set("contact")} className="rounded-2xl py-3"/></Field>
          <Field label="Birthday"><Input type="date" value={f.birthday} onChange={set("birthday")} className="rounded-2xl py-3"/></Field>
        </div>
        <div className="mt-5 space-y-5">
          <Field label="Subject expertise"><Chips multi options={[...SUBJECTS, "Reading"]} value={subjects} onChange={setSubjects}/></Field>
          <Field label="Grade bands"><Chips multi options={GRADE_CHOICES} value={bands} onChange={setBands}/></Field>
          <Field label="Resume (PDF)">
            <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#b8b8b8] text-center text-blue-600 hover:bg-blue-50/50">
              <CloudUpload className="h-7 w-7"/><span className="mt-1 text-sm font-bold">{resume.name || "Browse File"}</span><input className="sr-only" type="file" accept=".pdf,application/pdf" onChange={(e) => up(e.target.files?.[0], "resume")}/>
            </label>
          </Field>
        </div>
      </div>
      {msg && <div className="mt-4"><Alert kind="error">{msg.text}</Alert></div>}
    </section> : <>
      <section className="relative mt-24 rounded-2xl bg-white shadow-sm">
        <div className="absolute -top-16 left-1/2 -translate-x-1/2"><Avatar photo={photo} large/><label className="absolute -bottom-1 -right-1 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-white text-slate-600 shadow" aria-label="Change profile photo"><Pencil className="h-5 w-5"/><input className="sr-only" type="file" accept="image/*" onChange={(e) => up(e.target.files?.[0], "photo")}/></label></div>
        <div className="hidden justify-end px-6 pt-6 sm:flex sm:px-12"><Button onClick={() => setEditing(true)} className="min-w-44 rounded-2xl bg-blue-600 hover:bg-blue-700">Edit Profile</Button></div>
        <div className="px-6 pb-5 pt-28 text-center sm:pt-12"><h2 className="text-2xl font-bold text-[#5d5b5a]">{f.fullName || "Tutor"}</h2><p className="mt-1 text-lg font-semibold text-slate-400">{t.status === "active" ? "Tutor" : "Applicant"}</p></div>
        <div className="mb-5 flex justify-center px-6 sm:hidden"><Button onClick={() => setEditing(true)} className="min-w-44 rounded-2xl bg-blue-600 hover:bg-blue-700">Edit Profile</Button></div>
        <div className="rounded-b-2xl bg-blue-600 px-8 py-5 text-white sm:px-12">
          <p><b>Birthday:</b> <span className="ml-2">{formattedBirthday}</span></p>
          <p><b>Age:</b> <span className="ml-2">{age || "Not provided"}{typeof age === "number" ? " y/o" : ""}</span></p>
          <p><b>Contact Number:</b> <span className="ml-2">{f.contact || "Not provided"}</span></p>
          <p><b>Email:</b> <span className="ml-2">{s.me.email || "Not provided"}</span></p>
        </div>
      </section>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <InfoPanel title="Subject Expertise" icon={BookOpen} values={subjects}/>
        <InfoPanel title="Grade Levels" icon={GraduationCap} values={bands}/>
      </div>
      <section className="mt-5 grid gap-5 rounded-2xl border-2 border-blue-600 bg-white p-5 sm:grid-cols-[160px_1fr] sm:items-center sm:px-8">
        <h2 className="text-center text-xl font-bold text-[#5d5b5a]">Resume</h2>
        {resume.data ? <button type="button" onClick={() => { if (!openPdfDataUrl(resume.data)) setMsg({ kind: "error", text: "The resume could not be opened. Please allow pop-ups and try again." }); }} className="flex min-w-0 items-center justify-between gap-4 rounded-2xl bg-[#e7e7e7] px-5 py-4 text-left text-sm font-bold text-[#5d5b5a] hover:bg-slate-200"><span className="flex min-w-0 items-center gap-3 truncate"><FileText className="h-5 w-5 shrink-0"/>{resume.name || "Resume.pdf"}</span><span className="shrink-0 text-slate-500">Open PDF</span></button> : <div className="rounded-2xl bg-slate-100 px-5 py-4 text-sm text-slate-500">No resume uploaded</div>}
      </section>
    </>}

    {savedModal && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4" onClick={() => setSavedModal(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="profile-saved-title" className="relative w-full max-w-md rounded-2xl bg-white px-8 py-12 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => setSavedModal(false)} aria-label="Close" className="absolute right-5 top-5 text-slate-600 hover:text-slate-900"><X className="h-7 w-7"/></button>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime-600 text-white"><Check className="h-12 w-12" strokeWidth={4}/></div>
        <h2 id="profile-saved-title" className="mt-6 text-2xl font-bold text-[#424242]">Profile Saved!</h2>
      </div>
    </div>}
  </div>;
}

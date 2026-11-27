"use client";

import Image from "next/image";
import { Check, Pencil, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { ageFromBirthday, ageMonthsFromBirthday } from "@/lib/dates";
import { readFileAsDataURL } from "@/lib/files";
import { useStore } from "@/lib/store";

const GRADE_CHOICES = ["Nursery", "Preschool", "Kinder", ...Array.from({ length: 10 }, (_, index) => `Grade ${index + 1}`)];
const gradeChoiceForProfile = (grade) => {
  if (GRADE_CHOICES.includes(grade)) return grade;
  if (grade === "Elementary") return "Grade 1";
  if (grade === "High School") return "Grade 7";
  return "";
};
const draftKey = (id) => `whizzkids-tutee-profile-draft-${id}`;
const profileFields = (profile) => ({ fullName: profile.fullName, birthday: profile.birthday || "", gradeLevel: gradeChoiceForProfile(profile.gradeLevel), contact: profile.contact || "", guardianName: profile.guardianName || "", photo: profile.photo || "" });

function Avatar({ photo, onPhotoChange }) {
  return <div className="relative h-40 w-40 shrink-0">
    <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#dce2f0] text-[#a5a9b3]">
      {photo ? <Image src={photo} alt="Student profile" fill unoptimized className="object-cover"/> : <UserRound className="h-20 w-20 fill-[#a5a9b3] stroke-[#a5a9b3]" aria-hidden="true"/>}
    </div>
    <label className="absolute -bottom-1 -right-1 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-white text-slate-600 shadow" aria-label="Change profile photo"><Pencil className="h-5 w-5"/><input className="sr-only" type="file" accept="image/*" onChange={onPhotoChange}/></label>
  </div>;
}

export default function TuteeProfile() {
  const s = useStore();
  const id = s.me.id;
  const p = s.db.tutees.find((t) => t.userId === id);
  const [f, setF] = useState(() => profileFields(p));
  const [editing, setEditing] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [savedModal, setSavedModal] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(draftKey(id));
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft?.fields) {
            setF({ ...profileFields(p), ...draft.fields });
            setEditing(true);
          }
        }
      } catch { /* Ignore an unavailable or invalid local draft. */ }
      setDraftReady(true);
    }, 0);
    return () => clearTimeout(timer);
  // The profile is loaded before this page is available, and the draft is read once per user.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    if (!draftReady || !editing) return;
    try { localStorage.setItem(draftKey(id), JSON.stringify({ fields: f })); } catch { /* Storage may be unavailable. */ }
  }, [draftReady, editing, f, id]);
  const set = (key) => (event) => setF((previous) => ({ ...previous, [key]: event.target.value }));
  const changePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const photo = await readFileAsDataURL(file);
      setF((previous) => ({ ...previous, photo }));
      setEditing(true);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the profile photo.");
    }
  };
  const age = f.birthday ? ageFromBirthday(f.birthday) : null;
  const birthday = f.birthday ? new Date(`${f.birthday}T00:00:00`).toLocaleDateString("en-US") : "Not provided";

  const save = async () => {
    const ageMonths = ageMonthsFromBirthday(f.birthday);
    if (ageMonths === null || ageMonths < 32) {
      setError("Children must be at least 2 years and 8 months old to enroll.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await s.saveTuteeProfile(id, { ...f });
      if (!result?.ok) throw new Error(result?.error || "Profile could not be saved. Please try again.");
      try { localStorage.removeItem(draftKey(id)); } catch { /* Storage may be unavailable. */ }
      setEditing(false);
      setSavedModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setF(profileFields(p));
    setEditing(false);
    setError("");
    try { localStorage.removeItem(draftKey(id)); } catch { /* Storage may be unavailable. */ }
  };

  return <div className="mx-auto max-w-5xl pb-10">
    <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-black">Profile</h1>

    {editing ? <section className="relative mt-28 rounded-2xl bg-white px-6 pb-10 pt-6 shadow-sm sm:px-12">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2"><Avatar photo={f.photo} onPhotoChange={changePhoto}/></div>
      <div className="mb-8 hidden justify-end gap-3 sm:flex"><Button disabled={saving} onClick={cancel} className="min-w-32 rounded-2xl bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</Button><Button disabled={saving} onClick={save} className="min-w-44 rounded-2xl bg-brand-600 hover:bg-brand-700">{saving ? "Saving…" : "Save Profile"}</Button></div>
      <div className="mb-6 mt-14 flex justify-center gap-3 sm:hidden"><Button disabled={saving} onClick={cancel} className="min-w-32 rounded-2xl bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</Button><Button disabled={saving} onClick={save} className="min-w-44 rounded-2xl bg-brand-600 hover:bg-brand-700">{saving ? "Saving…" : "Save Profile"}</Button></div>
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <Field label="Name"><Input required value={f.fullName} onChange={set("fullName")} className="rounded-2xl py-3"/></Field>
        <Field label="Birthday" hint="Children must be at least 2 years and 8 months old to enroll."><Input type="date" required value={f.birthday} onChange={set("birthday")} className="rounded-2xl py-3"/></Field>
        <Field label="Grade level"><Select required value={f.gradeLevel} onChange={set("gradeLevel")} className="rounded-2xl py-3"><option value="">Select…</option>{GRADE_CHOICES.map((grade) => <option key={grade}>{grade}</option>)}</Select></Field>
        <Field label="Contact number"><Input required value={f.contact} onChange={set("contact")} className="rounded-2xl py-3"/></Field>
        <div className="sm:col-span-2"><Field label="Parent / guardian name"><Input value={f.guardianName} onChange={set("guardianName")} className="rounded-2xl py-3"/></Field></div>
      </div>
      {error && <div className="mt-5"><Alert kind="error">{error}</Alert></div>}
    </section> : <section className="relative mt-24 rounded-2xl bg-white shadow-sm">
      <div className="absolute -top-16 left-1/2 -translate-x-1/2"><Avatar photo={f.photo} onPhotoChange={changePhoto}/></div>
      <div className="relative z-10 hidden justify-end px-6 pt-6 sm:flex sm:px-12"><Button onClick={() => setEditing(true)} className="min-w-44 rounded-2xl bg-brand-600 hover:bg-brand-700">Edit Profile</Button></div>
      <div className="px-6 pb-5 pt-28 text-center sm:pt-12"><h2 className="text-2xl font-bold text-[#5d5b5a]">{f.fullName || "Student"}</h2><p className="mt-1 text-lg font-semibold text-slate-400">{f.gradeLevel || "Grade not set"}</p></div>
      <div className="relative z-10 mb-5 flex justify-center px-6 sm:hidden"><Button onClick={() => setEditing(true)} className="min-w-44 rounded-2xl bg-brand-600 hover:bg-brand-700">Edit Profile</Button></div>
      <div className="rounded-b-2xl bg-brand-600 px-8 py-5 text-white sm:px-12">
        <p><b>Birthday:</b> <span className="ml-2">{birthday}</span>{age !== null && <span className="ml-2">({age} y/o)</span>}</p>
        <p><b>Parent/Guardian Name:</b> <span className="ml-2">{f.guardianName || "Not provided"}</span></p>
        <p><b>Contact Number:</b> <span className="ml-2">{f.contact || "Not provided"}</span></p>
        <p><b>Email:</b> <span className="ml-2">{s.me.email || "Not provided"}</span></p>
      </div>
    </section>}

    {savedModal && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4" onClick={() => setSavedModal(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="tutee-profile-saved-title" className="relative w-full max-w-md rounded-2xl bg-white px-8 py-12 text-center shadow-xl" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => setSavedModal(false)} aria-label="Close" className="absolute right-5 top-5 text-slate-600 hover:text-slate-900"><X className="h-7 w-7"/></button>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime-600 text-white"><Check className="h-12 w-12" strokeWidth={4}/></div>
        <h2 id="tutee-profile-saved-title" className="mt-6 text-2xl font-bold text-[#424242]">Profile Saved!</h2>
      </div>
    </div>}
  </div>;
}

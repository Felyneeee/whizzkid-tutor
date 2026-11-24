"use client";

import Image from "next/image";
import { Check, Pencil, UserRound, X } from "lucide-react";
import { useState } from "react";
import { Alert, Button, Field, Input, Select } from "@/components/ui";
import { ageFromBirthday } from "@/lib/dates";
import { readFileAsDataURL } from "@/lib/files";
import { useStore } from "@/lib/store";

const GRADE_CHOICES = ["Nursery", "Preschool", "Kinder", ...Array.from({ length: 10 }, (_, index) => `Grade ${index + 1}`)];
const gradeChoiceForProfile = (grade) => {
  if (GRADE_CHOICES.includes(grade)) return grade;
  if (grade === "Elementary") return "Grade 1";
  if (grade === "High School") return "Grade 7";
  return "";
};

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
  const [f, setF] = useState({ fullName: p.fullName, birthday: p.birthday || "", gradeLevel: gradeChoiceForProfile(p.gradeLevel), contact: p.contact || "", guardianName: p.guardianName || "", photo: p.photo || "" });
  const [editing, setEditing] = useState(false);
  const [savedModal, setSavedModal] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setF((previous) => ({ ...previous, [key]: event.target.value }));
  const changePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const photo = await readFileAsDataURL(file);
      setF((previous) => ({ ...previous, photo }));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read the profile photo.");
    }
  };
  const age = f.birthday ? ageFromBirthday(f.birthday) : null;
  const birthday = f.birthday ? new Date(`${f.birthday}T00:00:00`).toLocaleDateString("en-US") : "Not provided";

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await s.saveTuteeProfile(id, { ...f });
      if (!result?.ok) throw new Error(result?.error || "Profile could not be saved. Please try again.");
      setEditing(false);
      setSavedModal(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="mx-auto max-w-5xl pb-10">
    <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-black">Profile</h1>

    {editing ? <section className="relative mt-28 rounded-2xl bg-white px-6 pb-10 pt-6 shadow-sm sm:px-12">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2"><Avatar photo={f.photo} onPhotoChange={changePhoto}/></div>
      <div className="mb-8 flex justify-end"><Button disabled={saving} onClick={save} className="min-w-44 rounded-2xl bg-blue-600 hover:bg-blue-700">{saving ? "Saving…" : "Save Profile"}</Button></div>
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        <Field label="Name"><Input required value={f.fullName} onChange={set("fullName")} className="rounded-2xl py-3"/></Field>
        <Field label="Birthday"><Input type="date" required value={f.birthday} onChange={set("birthday")} className="rounded-2xl py-3"/></Field>
        <Field label="Grade level"><Select required value={f.gradeLevel} onChange={set("gradeLevel")} className="rounded-2xl py-3"><option value="">Select…</option>{GRADE_CHOICES.map((grade) => <option key={grade}>{grade}</option>)}</Select></Field>
        <Field label="Contact number"><Input required value={f.contact} onChange={set("contact")} className="rounded-2xl py-3"/></Field>
        <div className="sm:col-span-2"><Field label="Parent / guardian name"><Input value={f.guardianName} onChange={set("guardianName")} className="rounded-2xl py-3"/></Field></div>
      </div>
      {error && <div className="mt-5"><Alert kind="error">{error}</Alert></div>}
    </section> : <section className="relative mt-24 rounded-2xl bg-white shadow-sm">
      <div className="absolute -top-16 left-1/2 -translate-x-1/2"><Avatar photo={f.photo} onPhotoChange={changePhoto}/></div>
      <div className="relative z-10 flex justify-end px-6 pt-6 sm:px-12"><Button onClick={() => setEditing(true)} className="min-w-44 rounded-2xl bg-blue-600 hover:bg-blue-700">Edit Profile</Button></div>
      <div className="px-6 pb-5 pt-12 text-center"><h2 className="text-2xl font-bold text-[#5d5b5a]">{f.fullName || "Student"}</h2><p className="mt-1 text-lg font-semibold text-slate-400">{f.gradeLevel || "Grade not set"}</p></div>
      <div className="rounded-b-2xl bg-blue-600 px-8 py-5 text-white sm:px-12">
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

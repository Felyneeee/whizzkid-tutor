"use client";

import Image from "next/image";
import { Check, Pencil, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Button, Field, Input } from "@/components/ui";
import { readFileAsDataURL } from "@/lib/files";
import { ageFromBirthday } from "@/lib/dates";
import { useStore } from "@/lib/store";

const adminDraftKey = (id) => `whizzkids-admin-profile-draft-${id}`;

function Avatar({ photo, onChange }) {
  return <div className="relative h-40 w-40 shrink-0">
    <div className="relative grid h-full w-full place-items-center overflow-hidden rounded-full bg-[#dce2f0] text-[#a5a9b3]">
      {photo ? <Image src={photo} alt="Admin profile" fill unoptimized className="object-cover"/> : <UserRound className="h-20 w-20 fill-[#a5a9b3] stroke-[#a5a9b3]" aria-hidden="true"/>}
    </div>
    <label className="absolute -bottom-1 -right-1 z-10 grid h-8 w-8 cursor-pointer place-items-center rounded-lg bg-white text-slate-600 shadow" aria-label="Change profile photo"><Pencil className="h-5 w-5"/><input className="sr-only" type="file" accept="image/*" onChange={onChange}/></label>
  </div>;
}

export default function AdminProfilePage() {
  const s = useStore();
  const profile = s.db.adminProfiles?.find((item) => item.id === s.me.id);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const [form, setForm] = useState(() => ({
    fullName: profile?.fullName || s.me.username || "Administrator",
    age: profile?.age == null ? "" : String(profile.age),
    contact: profile?.contact || "",
    birthday: profile?.birthday || "",
    photo: profile?.photo || "",
  }));
  const initialForm = () => ({
    fullName: profile?.fullName || s.me.username || "Administrator",
    age: profile?.age == null ? "" : String(profile.age),
    contact: profile?.contact || "",
    birthday: profile?.birthday || "",
    photo: profile?.photo || "",
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const raw = localStorage.getItem(adminDraftKey(s.me.id));
        if (raw) {
          const draft = JSON.parse(raw);
          if (draft?.fields) { setForm({ ...initialForm(), ...draft.fields }); setEditing(true); }
        }
      } catch { /* Ignore an unavailable or invalid local draft. */ }
      setDraftReady(true);
    }, 0);
    return () => clearTimeout(timer);
  // The profile is loaded before this page is available, and the draft is read once per user.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.me.id]);
  useEffect(() => {
    if (!draftReady || !editing) return;
    try { localStorage.setItem(adminDraftKey(s.me.id), JSON.stringify({ fields: form })); } catch { /* Storage may be unavailable. */ }
  }, [draftReady, editing, form, s.me.id]);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const changePhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return setError("Profile photo must be 5 MB or smaller.");
    try {
      setForm((current) => ({ ...current, photo: "" }));
      const photo = await readFileAsDataURL(file);
      setForm((current) => ({ ...current, photo }));
      setEditing(true);
      setError("");
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Could not read the profile photo.");
    }
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const result = await s.saveAdminProfile(s.me.id, { ...form, age: form.age ? Number(form.age) : null });
      if (!result?.ok) throw new Error(result?.error || "Profile could not be saved. Please try again.");
      try { localStorage.removeItem(adminDraftKey(s.me.id)); } catch { /* Storage may be unavailable. */ }
      setEditing(false);
      setSaved(true);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "Profile could not be saved. Please try again.");
    } finally {
      setSaving(false);
    }
  };
  const cancel = () => {
    setForm(initialForm());
    setEditing(false);
    setError("");
    try { localStorage.removeItem(adminDraftKey(s.me.id)); } catch { /* Storage may be unavailable. */ }
  };
  const age = form.birthday ? ageFromBirthday(form.birthday) : form.age;
  const birthdayLabel = form.birthday ? new Date(`${form.birthday}T00:00:00`).toLocaleDateString("en-US") : "Not provided";

  return <div className="mx-auto max-w-5xl pb-10">
    <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-black">Profile</h1>

    {editing ? <section className="relative mt-28 rounded-2xl bg-white px-6 pb-8 pt-6 shadow-sm sm:px-12">
      <div className="absolute -top-24 left-1/2 -translate-x-1/2"><Avatar photo={form.photo} onChange={changePhoto}/></div>
      <div className="mb-10 flex flex-wrap items-center justify-center gap-2 sm:justify-end"><Button size="sm" disabled={saving} onClick={cancel} className="rounded-2xl bg-slate-200 text-slate-700 hover:bg-slate-300">Cancel</Button><Button disabled={saving} onClick={save} className="min-w-44 rounded-2xl bg-brand-600 hover:bg-brand-700">{saving ? "Saving…" : "Save Profile"}</Button></div>
      <div className="border-l-4 border-slate-100 pl-5 sm:pl-6">
        <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={form.fullName} onChange={set("fullName")} className="rounded-2xl py-3"/></Field>
          <Field label="Age"><Input type="number" min="0" max="120" value={form.age} onChange={set("age")} className="rounded-2xl py-3"/></Field>
          <Field label="Contact"><Input value={form.contact} onChange={set("contact")} className="rounded-2xl py-3"/></Field>
          <Field label="Birthday"><Input type="date" value={form.birthday} onChange={set("birthday")} className="rounded-2xl py-3"/></Field>
        </div>
      </div>
      {error && <div className="mt-5"><Alert kind="error">{error}</Alert></div>}
    </section> : <section className="relative mt-24 rounded-2xl bg-white shadow-sm">
      <div className="absolute -top-16 left-1/2 -translate-x-1/2"><Avatar photo={form.photo} onChange={changePhoto}/></div>
      <div className="relative z-10 flex justify-end px-6 pt-6 sm:px-12"><Button onClick={() => setEditing(true)} className="min-w-44 rounded-2xl bg-brand-600 hover:bg-brand-700">Edit Profile</Button></div>
      <div className="px-6 pb-5 pt-12 text-center"><h2 className="text-2xl font-bold text-[#5d5b5a]">{form.fullName || "Administrator"}</h2><p className="mt-1 text-lg font-semibold text-slate-400">Admin</p></div>
      <div className="rounded-b-2xl bg-brand-600 px-8 py-5 text-white sm:px-12">
        <p><b>Birthday:</b> <span className="ml-2">{birthdayLabel}</span></p>
        <p><b>Age:</b> <span className="ml-2">{age || "Not provided"}{age ? " y/o" : ""}</span></p>
        <p><b>Contact Number:</b> <span className="ml-2">{form.contact || "Not provided"}</span></p>
        <p><b>Email:</b> <span className="ml-2">{s.me.email || "Not provided"}</span></p>
      </div>
    </section>}

    {saved && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/35 p-4" onClick={() => setSaved(false)}>
      <div role="dialog" aria-modal="true" aria-labelledby="admin-profile-saved-title" className="relative w-full max-w-md rounded-2xl bg-white px-8 py-12 text-center shadow-xl" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={() => setSaved(false)} aria-label="Close" className="absolute right-5 top-5 text-slate-600 hover:text-slate-900"><X className="h-7 w-7"/></button>
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-lime-600 text-white"><Check className="h-12 w-12" strokeWidth={4}/></div>
        <h2 id="admin-profile-saved-title" className="mt-6 text-2xl font-bold text-[#424242]">Profile Saved!</h2>
      </div>
    </div>}
  </div>;
}

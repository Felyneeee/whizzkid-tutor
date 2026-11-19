"use client";
import Image from "next/image";
import { UserRound } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, Chips, Field, Input, PageHeader, Textarea } from "@/components/ui";
import { SUBJECTS } from "@/lib/constants";
import { readFileAsDataURL, readPdfAsDataURL } from "@/lib/files";
import { useStore } from "@/lib/store";
const GRADE_CHOICES = ["Nursery", "Preschool", "Kinder", "Elementary", "High School"];
const choicesForGradeBands = (bands) => bands.flatMap((band) => {
    if (band === "Preschool") return ["Preschool"];
    if (band === "Junior High") return ["High School"];
    if (band === "Senior High") return [];
    return GRADE_CHOICES.includes(band) ? [band] : [];
});
export default function TutorProfilePage() {
    const s = useStore();
    const id = s.me.id;
    const t = s.db.tutors.find((x) => x.userId === id);
    const [f, setF] = useState({ fullName: t.fullName, age: String(t.age ?? ""), contact: t.contact, bio: t.bio, birthday: t.birthday || "" });
    const [subjects, setSubjects] = useState(t.subjects);
    const [bands, setBands] = useState(() => choicesForGradeBands(t.gradeBands));
    const [photo, setPhoto] = useState(t.photo);
    const [resume, setResume] = useState({ name: t.resumeName, data: t.resumeData });
    const [msg, setMsg] = useState(null);
    const [saving, setSaving] = useState(false);
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
    const up = async (file, kind) => {
        if (!file)
            return;
        try {
            const data = kind === "photo"
                ? await readFileAsDataURL(file)
                : await readPdfAsDataURL(file);
            if (kind === "photo")
                setPhoto(data);
            else
                setResume({ name: file.name, data });
        }
        catch (e) {
            setMsg({ k: "error", t: e.message });
        }
    };
    return (<>
      <PageHeader title="My profile" subtitle="Personal and professional information." action={<Badge status={t.status}/>}/>
      <Card className="max-w-3xl space-y-4">
        <div className="flex items-center gap-4">
          {photo ? <Image src={photo} alt="" width={80} height={80} unoptimized className="h-20 w-20 rounded-2xl object-cover"/> : <div className="grid h-20 w-20 place-items-center rounded-full bg-slate-200 text-slate-500"><UserRound className="h-10 w-10" strokeWidth={1.8} aria-hidden="true"/></div>}
          <Field label="Profile photo">
            <Input type="file" accept="image/*" onChange={(e) => up(e.target.files?.[0], "photo")}/>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><Input value={f.fullName} onChange={set("fullName")}/></Field>
          <Field label="Age"><Input type="number" value={f.age} onChange={set("age")}/></Field>
          <Field label="Contact"><Input value={f.contact} onChange={set("contact")}/></Field>
          <Field label="Birthday"><Input type="date" value={f.birthday} onChange={set("birthday")}/></Field>
        </div>
        <Field label="Subject expertise">
          <Chips multi options={[...SUBJECTS, "Reading"]} value={subjects} onChange={setSubjects}/>
        </Field>
        <Field label="Grade bands" hint="Nursery, Preschool, Kinder, Elementary (Grades 1–6), and High School (Grades 7–10)">
          <Chips multi options={GRADE_CHOICES} value={bands} onChange={setBands}/>
        </Field>
        <Field label="Bio"><Textarea value={f.bio} onChange={set("bio")}/></Field>
        <Field label="Resume (PDF)" hint={resume.name}>
          <Input type="file" accept=".pdf,application/pdf" onChange={(e) => up(e.target.files?.[0], "resume")}/>
        </Field>
        {msg && <Alert kind={msg.k === "success" ? "success" : "error"}>{msg.t}</Alert>}
        <Button disabled={saving} onClick={async () => {
            setSaving(true);
            setMsg(null);
            try {
                const result = await s.saveTutorProfile(id, { fullName: f.fullName, age: f.age ? Number(f.age) : null, contact: f.contact, bio: f.bio, birthday: f.birthday || undefined, subjects, gradeBands: [...new Set(bands)], photo, resumeName: resume.name, resumeData: resume.data });
                if (!result?.ok) throw new Error(result?.error || "Profile could not be saved. Please try again.");
                setMsg({ k: "success", t: "Profile saved." });
            }
            catch (e) {
                setMsg({ k: "error", t: e instanceof Error ? e.message : "Profile could not be saved. Please try again." });
            }
            finally {
                setSaving(false);
            }
        }}>
          {saving ? "Saving…" : "Save profile"}
        </Button>
      </Card>
    </>);
}

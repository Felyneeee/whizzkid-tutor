"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Chips, Field, Input, Textarea, cn } from "@/components/ui";
import { GRADE_BANDS, READING_SKILLS, SUBJECTS } from "@/lib/constants";
import { ageFromBirthday, todayISO } from "@/lib/dates";
import { readFileAsDataURL, readPdfAsDataURL } from "@/lib/files";
import { useStore } from "@/lib/store";
export default function RegisterTutor() {
    const s = useStore();
    const router = useRouter();
    const [type, setType] = useState("new");
    const [f, setF] = useState({ email: "", username: "", password: "", fullName: "", contact: "", birthday: "", bio: "" });
    const [subjects, setSubjects] = useState([]);
    const [bands, setBands] = useState([]);
    const [resume, setResume] = useState({ name: "", data: "" });
    const [photo, setPhoto] = useState("");
    const [err, setErr] = useState("");
    const [success, setSuccess] = useState("");
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
    const calculatedAge = f.birthday ? ageFromBirthday(f.birthday) : null;
    const upload = async (file, kind) => {
        if (!file)
            return;
        try {
            const data = kind === "resume"
                ? await readPdfAsDataURL(file)
                : await readFileAsDataURL(file);
            if (kind === "resume")
                setResume({ name: file.name, data });
            else
                setPhoto(data);
            setErr("");
        }
        catch (e) {
            setErr(e.message);
        }
    };
    return (<Card>
      <h1 className="text-2xl font-extrabold">Tutor registration</h1>
      <p className="mb-4 text-sm text-slate-500">Tell us about yourself. An admin will review your details before activating your tutor account.</p>
      <div className="mb-5 grid grid-cols-2 gap-2">
        {["new", "existing"].map((t) => (<button key={t} type="button" onClick={() => setType(t)} className={cn("rounded-xl border-2 p-3 text-left text-sm", type === t ? "border-brand-500 bg-brand-50" : "border-slate-200")}>
            <div className="font-extrabold">{t === "new" ? "New Applicant" : "Existing Tutor"}</div>
            <div className="text-xs text-slate-500">{t === "new" ? "Application → review → interview → approval" : "Already teaching with us? Verify your account"}</div>
          </button>))}
      </div>
      <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            if (f.password.length < 12)
                return setErr("Password must be at least 12 characters.");
            if (calculatedAge === null || calculatedAge < 18 || calculatedAge > 80)
                return setErr("Enter a birthday that makes you between 18 and 80 years old.");
            if (!subjects.length || !bands.length)
                return setErr("Pick at least one subject and one grade band.");
            if (type === "new" && !resume.data)
                return setErr("Please upload your resume.");
            const r = await s.registerTutor({
                email: f.email,
                username: f.username,
                password: f.password,
                applicantType: type,
                fullName: f.fullName,
                age: calculatedAge,
                contact: f.contact,
                photo,
                resumeName: resume.name,
                resumeData: resume.data,
                subjects,
                gradeBands: bands,
                bio: f.bio,
                birthday: f.birthday || undefined,
            });
            if (!r.ok) {
                if (r.error.startsWith("Account created."))
                    setSuccess(r.error);
                else
                    setErr(r.error);
                return;
            }
            router.replace("/tutor");
        }}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email">
            <Input type="email" required value={f.email} onChange={set("email")}/>
          </Field>
          <Field label="Username">
            <Input required value={f.username} onChange={set("username")}/>
          </Field>
          <Field label="Password">
            <Input type="password" required minLength={12} value={f.password} onChange={set("password")}/>
          </Field>
          <Field label="Full name">
            <Input required value={f.fullName} onChange={set("fullName")}/>
          </Field>
          <Field label="Birthday">
            <Input type="date" required max={todayISO()} value={f.birthday} onChange={set("birthday")}/>
          </Field>
          <Field label="Contact number">
            <Input required value={f.contact} onChange={set("contact")}/>
          </Field>
          <Field label="Profile photo">
            <Input type="file" accept="image/*" onChange={(e) => upload(e.target.files?.[0], "photo")}/>
          </Field>
        </div>
        <Field label="Subject expertise">
          <Chips multi options={[...SUBJECTS, "Reading"]} value={subjects} onChange={setSubjects}/>
        </Field>
        <Field label="Grade levels you can teach" hint={`Reading skills covered: ${READING_SKILLS.join(", ")}`}>
          <Chips multi options={GRADE_BANDS} value={bands} onChange={setBands}/>
        </Field>
        <Field label="Short bio / experience">
          <Textarea value={f.bio} onChange={set("bio")}/>
        </Field>
        <Field label={type === "new" ? "Resume (PDF)" : "Resume (optional PDF)"} hint={resume.name || undefined}>
          <Input type="file" accept=".pdf,application/pdf" onChange={(e) => upload(e.target.files?.[0], "resume")}/>
        </Field>
        {err && <Alert kind="error">{err}</Alert>}
        {success && <Alert kind="success">{success}</Alert>}
        <Button type="submit" className="w-full" disabled={!s.ready}>
          {type === "new" ? "Submit application" : "Submit for verification"}
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link href="/login" className="font-bold text-brand-600">
          Log in
        </Link>
      </p>
    </Card>);
}

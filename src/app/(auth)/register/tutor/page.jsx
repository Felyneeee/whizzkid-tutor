"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CloudUpload, Eye, EyeOff, FileText } from "lucide-react";
import { Alert, Button, Card, Chips, Field, Input, PhoneInput } from "@/components/ui";
import { SUBJECTS } from "@/lib/constants";
import { ageFromBirthday, todayISO } from "@/lib/dates";
import { readFileAsDataURL, readPdfAsDataURL } from "@/lib/files";
import { useStore } from "@/lib/store";
const GRADE_CHOICES = ["Nursery", "Preschool", "Kinder", "Elementary", "High School"];
const gradeBandForChoice = (grade) => ["Nursery", "Preschool", "Kinder"].includes(grade) ? "Preschool" : grade === "High School" ? "Junior High" : grade;
export default function RegisterTutor({ initialType = "new" }) {
    const s = useStore();
    const router = useRouter();
    const type = initialType;
    const [f, setF] = useState({ email: "", username: "", password: "", fullName: "", contact: "", birthday: "", bio: "" });
    const [subjects, setSubjects] = useState([]);
    const [bands, setBands] = useState([]);
    const [resume, setResume] = useState({ name: "", data: "" });
    const [photo, setPhoto] = useState("");
    const [err, setErr] = useState("");
    const [success, setSuccess] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [confirm, setConfirm] = useState("");
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
    return (<>
      <Card className="p-7 sm:p-8">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">{type === "new" ? "Application Form" : "Account Activation"}</h1>
      <p className="mt-1 text-sm text-slate-500">{type === "new" ? "After filling out applicant form, an admin will review your resume and send an application status whether you’re rejected or scheduled for the interview." : "Already employed tutors must submit registration details to request account activation. An admin will verify your record and activate your access."}</p>
      <form className="mt-4 space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            if (f.password.length < 12)
                return setErr("Password must be at least 12 characters.");
            if (f.password !== confirm)
                return setErr("Passwords do not match.");
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
                gradeBands: [...new Set(bands.map(gradeBandForChoice))],
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
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field label="Email">
            <Input type="email" required value={f.email} onChange={set("email")}/>
          </Field></div>
          <Field label="Username">
            <Input required value={f.username} onChange={set("username")}/>
          </Field>
          <Field label="Full name">
            <Input required value={f.fullName} onChange={set("fullName")}/>
          </Field>
          <Field label="Password">
            <div className="relative"><Input type={showPassword ? "text" : "password"} required minLength={12} value={f.password} onChange={set("password")} className="pr-11"/><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <Eye className="h-4 w-4"/> : <EyeOff className="h-4 w-4"/>}</button></div>
          </Field>
          <Field label="Confirm password">
            <div className="relative"><Input type={showConfirm ? "text" : "password"} required minLength={12} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="pr-11"/><button type="button" onClick={() => setShowConfirm((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-700" aria-label={showConfirm ? "Hide password" : "Show password"}>{showConfirm ? <Eye className="h-4 w-4"/> : <EyeOff className="h-4 w-4"/>}</button></div>
          </Field>
          <Field label="Birthday">
            <Input type="date" required max={todayISO()} value={f.birthday} onChange={set("birthday")}/>
          </Field>
          <Field label="Contact number">
            <PhoneInput required value={f.contact} onChange={(contact) => setF((current) => ({ ...current, contact }))}/>
          </Field>
        </div>
        <Field label="Subject expertise">
          <Chips multi options={[...SUBJECTS, "Reading"]} value={subjects} onChange={setSubjects}/>
        </Field>
        <Field label="Grade levels you can teach">
          <Chips multi options={GRADE_CHOICES} value={bands} onChange={setBands}/>
        </Field>
        {type === "new" && <Field label="Resume (PDF)">
          <div className="flex flex-col gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center">
            <FileText className="h-8 w-8 shrink-0 text-slate-500" aria-hidden="true"/>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-800">{resume.name || "Upload your resume"}</p>
              <p className="text-xs text-slate-500">PDF file only</p>
            </div>
            <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">
              <CloudUpload className="h-4 w-4" aria-hidden="true"/>Browse files
              <input type="file" accept=".pdf,application/pdf" className="sr-only" onChange={(e) => upload(e.target.files?.[0], "resume")}/>
            </label>
          </div>
        </Field>}
        {err && <Alert kind="error">{err}</Alert>}
        {success && <Alert kind="success">{success}</Alert>}
        <Button type="submit" className="w-full" disabled={!s.ready}>
          Submit
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Already registered?{" "}
        <Link href="/login" className="font-bold text-brand-600">
          Log in Here
        </Link>
      </p>
      </Card>
      <button type="button" onClick={() => router.back()} className="mx-auto mt-7 flex items-center gap-3 text-sm font-bold text-slate-800 hover:text-brand-700">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-white"><ArrowLeft className="h-4 w-4"/></span>Back
      </button>
    </>);
}

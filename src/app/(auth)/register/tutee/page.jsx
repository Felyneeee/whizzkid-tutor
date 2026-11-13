"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { useStore } from "@/lib/store";
export default function RegisterTutee() {
    const s = useStore();
    const router = useRouter();
    const [f, setF] = useState({ email: "", username: "", password: "", confirm: "" });
    const [err, setErr] = useState("");
    const [success, setSuccess] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
    return (<>
      <Card className="p-7 sm:p-9">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Registration Form</h1>
      <p className="mt-1 text-sm text-slate-500">Create a tutee account first before setting your profile.</p>
      <form className="mt-4 space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            if (f.password.length < 12)
                return setErr("Password must be at least 12 characters.");
            if (f.password !== f.confirm)
                return setErr("Passwords do not match.");
            const r = await s.registerTutee({ email: f.email, username: f.username, password: f.password });
            if (!r.ok) {
                if (r.error.startsWith("Account created."))
                    setSuccess(r.error);
                else
                    setErr(r.error);
                return;
            }
            router.replace("/tutee/profile");
        }}>
        <Field label="Email">
          <Input type="email" required value={f.email} onChange={set("email")}/>
        </Field>
        <Field label="Username">
          <Input required value={f.username} onChange={set("username")}/>
        </Field>
        <Field label="Password">
          <div className="relative">
            <Input type={showPassword ? "text" : "password"} required minLength={12} value={f.password} onChange={set("password")} className="pr-12"/>
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-brand-600 hover:bg-slate-50" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
              {showPassword ? <Eye className="h-5 w-5"/> : <EyeOff className="h-5 w-5"/>}
            </button>
          </div>
        </Field>
        <Field label="Confirm password">
          <div className="relative">
            <Input type={showConfirm ? "text" : "password"} required minLength={12} value={f.confirm} onChange={set("confirm")} className="pr-12"/>
            <button type="button" onClick={() => setShowConfirm((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-brand-600 hover:bg-slate-50" aria-label={showConfirm ? "Hide password" : "Show password"} aria-pressed={showConfirm}>
              {showConfirm ? <Eye className="h-5 w-5"/> : <EyeOff className="h-5 w-5"/>}
            </button>
          </div>
        </Field>
        {err && <Alert kind="error">{err}</Alert>}
        {success && <Alert kind="success">{success}</Alert>}
        <Button type="submit" className="w-full" disabled={!s.ready}>
          Register
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
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700">
          <ArrowLeft className="h-4 w-4"/>
        </span>
        Back
      </button>
    </>);
}

"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { homeFor } from "@/components/Shell";
import { useStore } from "@/lib/store";
export default function LoginPage() {
    const s = useStore();
    const router = useRouter();
    const [id, setId] = useState("");
    const [pw, setPw] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [err, setErr] = useState("");
    const submit = async (identifier, password) => {
        const r = await s.login(identifier, password);
        if (!r.ok)
            return setErr(r.error);
        router.replace(homeFor(r.user.role));
    };
    return (<>
      <Card>
      <header className="mb-2">
        <h1 className="text-2xl font-extrabold">Welcome back</h1>
      </header>
      <p className="mb-5 text-sm text-slate-500">Log in with your email or username.</p>
      <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            void submit(id, pw);
        }}>
        <Field label="Email or username">
          <Input value={id} onChange={(e) => setId(e.target.value)} required autoFocus/>
        </Field>
        <Field label="Password">
          <div className="relative">
            <Input type={showPassword ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} required className="pr-12"/>
            <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-xl text-slate-500 hover:bg-slate-50 hover:text-slate-700" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>
              {showPassword ? <Eye className="h-5 w-5"/> : <EyeOff className="h-5 w-5"/>}
            </button>
          </div>
        </Field>
        {err && <Alert kind="error">{err}</Alert>}
        <Button type="submit" className="w-full" disabled={!s.ready}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        Don’t have an account?{" "}
        <Link href="/register" className="font-bold text-brand-600">
          Register Here
        </Link>
      </p>
      </Card>
      <button type="button" onClick={() => router.back()} className="mx-auto mt-8 flex items-center gap-3 text-sm font-bold text-brand-700 hover:text-brand-800">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-white transition-colors hover:bg-brand-700">
          <ArrowLeft className="h-4 w-4"/>
        </span>
        Back
      </button>
    </>);
}

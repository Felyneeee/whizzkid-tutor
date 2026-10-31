"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, Field, Input } from "@/components/ui";
import { homeFor } from "@/components/Shell";
import { useStore } from "@/lib/store";
export default function LoginPage() {
    const s = useStore();
    const router = useRouter();
    const [id, setId] = useState("");
    const [pw, setPw] = useState("");
    const [err, setErr] = useState("");
    const submit = async (identifier, password) => {
        const r = await s.login(identifier, password);
        if (!r.ok)
            return setErr(r.error);
        router.replace(homeFor(r.user.role));
    };
    return (<Card>
      <h1 className="text-2xl font-extrabold">Welcome back</h1>
      <p className="mb-5 text-sm text-slate-500">Log in with your email or username.</p>
      <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            void submit(id, pw);
        }}>
        <Field label="Email or username">
          <Input value={id} onChange={(e) => setId(e.target.value)} required autoFocus/>
        </Field>
        <Field label="Password">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} required/>
        </Field>
        {err && <Alert kind="error">{err}</Alert>}
        <Button type="submit" className="w-full" disabled={!s.ready}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-500">
        New here?{" "}
        <Link href="/register" className="font-bold text-brand-600">
          Create an account
        </Link>
      </p>
    </Card>);
}

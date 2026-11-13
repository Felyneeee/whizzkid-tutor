"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui";

const choices = [
    {
        href: "/register/tutee",
        title: "Register as a parent/tutee",
        description: "Enroll your child in Playgroup, Reading Program, or Academic Tutorials",
        color: "border-blue-600 hover:bg-blue-50/50",
    },
    {
        href: "/register/tutor/activation",
        title: "Register as a tutor",
        description: "Already an existing Whizzkids tutor? Register and wait for the verification of your account.",
        color: "border-amber-400 hover:bg-amber-50/50",
    },
    {
        href: "/register/tutor/application",
        title: "Apply as a tutor",
        description: "Apply as a new Whizzkids tutor.",
        color: "border-black hover:bg-slate-50",
    },
];

export default function RegisterChoice() {
    const router = useRouter();
    return (<>
      <Card className="space-y-4 p-7 sm:p-8">
        <div className="mb-5">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-950">Join Whizzkids</h1>
          <p className="text-sm text-slate-500">Select which account to create:</p>
        </div>
        {choices.map((choice) => (
          <Link key={choice.title} href={choice.href} className={`block rounded-2xl border-[3px] px-6 py-5 transition-colors ${choice.color}`}>
            <h2 className="text-xl font-extrabold text-black">{choice.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{choice.description}</p>
          </Link>
        ))}
        <p className="pt-1 text-center text-xs font-semibold text-slate-500">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-brand-600">Log in Here</Link>
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

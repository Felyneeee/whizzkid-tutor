"use client";
import { Briefcase, ChevronDown, Clock, Mail, MapPin, Phone } from "lucide-react";
import Link from "next/link";
import { CENTER, FAQS, PROGRAMS } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { Button, Card, Logo } from "@/components/ui";
import { homeFor } from "@/components/Shell";
export default function Home() {
    const s = useStore();
    const hirings = s.db.hirings?.filter((h) => h.open) ?? [];
    return (<div>
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Logo className="text-xl"/>
          <nav className="hidden gap-6 text-sm font-semibold text-slate-600 md:flex">
            <a href="#programs">Programs</a>
            <a href="#about">About</a>
            <a href="#hiring">We&apos;re hiring</a>
            <a href="#faqs">FAQs</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="flex gap-2">
            {s.me ? (<Link href={homeFor(s.me.role)}>
                <Button>Go to dashboard</Button>
              </Link>) : (<>
                <Link href="/login">
                  <Button variant="secondary">Log in</Button>
                </Link>
                <Link href="/register">
                  <Button>Register</Button>
                </Link>
              </>)}
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2">
        <div>
          <span className="rounded-full bg-sunny-100 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-sunny-500">Online & Face-to-Face</span>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 md:text-5xl">
            Where little <span className="text-brand-600">whizzes</span> grow big.
          </h1>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/register/tutee">
              <Button size="md" className="!px-6 !py-3 text-base">
                Enroll my child
              </Button>
            </Link>
            <Link href="/register/tutor">
              <Button variant="secondary" className="!px-6 !py-3 text-base">
                Apply as tutor
              </Button>
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(PROGRAMS).map((k, i) => (<div key={k} className={`rounded-3xl p-6 text-center shadow-sm ${PROGRAMS[k].color} ${i === 2 ? "col-span-2" : ""}`}>
              <div className="text-5xl">{PROGRAMS[k].emoji}</div>
              <div className="mt-2 font-extrabold">{PROGRAMS[k].name}</div>
              <div className="text-xs font-semibold opacity-80">{PROGRAMS[k].ages}</div>
            </div>))}
        </div>
      </section>

      <section id="programs" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-3xl font-extrabold">Our programs</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {Object.keys(PROGRAMS).map((k) => (<Card key={k}>
              <div className="text-3xl">{PROGRAMS[k].emoji}</div>
              <h3 className="mt-2 text-lg font-extrabold">{PROGRAMS[k].name}</h3>
              <p className="mt-1 text-xs font-bold uppercase text-brand-600">{PROGRAMS[k].ages}</p>
              <p className="mt-2 text-sm text-slate-600">{PROGRAMS[k].blurb}</p>
            </Card>))}
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl px-4 py-12">
        <div className="rounded-3xl bg-brand-600 p-8 text-white md:p-12">
          <h2 className="text-3xl font-extrabold">About the center</h2>
          <div className="mt-4 grid gap-4 text-sm md:grid-cols-3">
            {[
            "Vetted tutors",
            "Smart matching",
            "Transparent rates",
        ].map((t) => (<div key={t} className="rounded-2xl bg-white/10 p-4">
                <div className="font-extrabold">{t}</div>
              </div>))}
          </div>
        </div>
      </section>

      <section id="hiring" className="mx-auto max-w-6xl px-4 py-12">
        <h2 className="text-3xl font-extrabold">We&apos;re hiring</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {hirings.map((h) => (<Card key={h.id}>
              <Briefcase className="h-6 w-6 text-brand-600"/>
              <h3 className="mt-2 font-extrabold">{h.title}</h3>
              <Link href="/register/tutor" className="mt-3 inline-block text-sm font-bold text-brand-600">
                Apply now →
              </Link>
            </Card>))}
        </div>
      </section>

      <section id="faqs" className="mx-auto max-w-3xl px-4 py-12">
        <h2 className="text-3xl font-extrabold">Frequently asked questions</h2>
        <div className="mt-6 space-y-3">
          {FAQS.map((f) => (<details key={f.q} className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
                {f.q}
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180"/>
              </summary>
            </details>))}
        </div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl px-4 py-12">
        <Card className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-4 text-2xl font-extrabold">Contact us</div>
          <div className="flex items-start gap-2 text-sm"><MapPin className="h-4 w-4 text-brand-600"/>{CENTER.address}</div>
          <div className="flex items-start gap-2 text-sm"><Phone className="h-4 w-4 text-brand-600"/>{CENTER.phone}</div>
          <div className="flex items-start gap-2 text-sm"><Mail className="h-4 w-4 text-brand-600"/>{CENTER.email}</div>
          <div className="flex items-start gap-2 text-sm"><Clock className="h-4 w-4 text-brand-600"/>{CENTER.hours}</div>
        </Card>
      </section>

      <footer className="border-t border-slate-100 bg-white py-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} {CENTER.name}. All rights reserved.
      </footer>
    </div>);
}

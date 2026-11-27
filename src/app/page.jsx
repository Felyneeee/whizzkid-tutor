"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Bell, CheckCheck, ChevronDown, Clock3, LogOut, Mail, MapPin, Phone, UserRound } from "lucide-react";
import { CENTER, FAQS } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { Button, Logo } from "@/components/ui";
import { homeFor } from "@/components/Shell";
import { NotificationIcon, notificationDestination, notificationDisplayText } from "@/components/notifications";
import { fmtDateTime } from "@/lib/dates";

const PROGRAM_DETAILS = [
  {
    title: "Reading Programs",
    ages: "3–15 years old",
    sections: [
      ["Reading for Beginners", "Phonemic awareness, reading sight words, phrases, and sentences for early readers."],
      ["Reading for Fluency", "Develop effortless and independent reading, accuracy, and comprehension skills."],
      ["Reading for Enrichment", "Advanced readers explore higher-level texts using more complex books and reading activities."],
      ["", "All reading programs include writing activities as well."],
    ],
  },
  {
    title: "Academic Tutorials",
    ages: "Nursery to High School",
    sections: [
      ["", "Reteaching lessons from school to support students who need extra guidance. (English, Filipino, Araling Panlipunan, Science, Mathematics)"],
      ["", "Enrichment lessons for those performing well in school."],
      ["", "Targeted instruction with relevant worksheets—not just homework help."],
    ],
  },
  {
    title: "Playgroup Class",
    ages: "2.8–4 years old",
    sections: [
      ["", "Fun and structured activities that prepare children for Preschool and develop early social, cognitive, and motor skills."],
      ["", "3x a week for 1 month (1 cycle)."],
    ],
  },
];

const HOME_FAQS = [
  FAQS.find((item) => item.q === "How do I enroll my child?"),
  FAQS.find((item) => item.q === "Are lessons online or face-to-face?"),
  FAQS.find((item) => item.q === "How are tutors matched to my child?"),
  { q: "Can I book a recurring schedule?", a: FAQS.find((item) => item.q.includes("schedules work"))?.a || "Choose a recurring schedule while booking." },
  FAQS.find((item) => item.q === "How much does it cost?"),
].filter(Boolean);

export default function Home() {
  const s = useStore();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const user = s.me;
  const role = user?.role;
  const base = role ? homeFor(role) : "";
  const profile = role === "admin" ? s.db.adminProfiles?.find((item) => item.id === user.id)
    : role === "tutor" ? s.db.tutors.find((item) => item.userId === user.id)
      : role === "tutee" ? s.db.tutees.find((item) => item.userId === user.id) : null;
  const displayName = role === "admin" ? profile?.fullName || "Admin" : profile?.fullName || user?.username || "Profile";
  const allUserNotifications = user ? (s.db.notifications || []).filter((item) => item.userId === user.id) : [];
  const userNotifications = allUserNotifications.slice(0, 8);
  const unread = allUserNotifications.filter((item) => !item.read).length;

  return <div id="top" className="relative min-h-screen overflow-hidden bg-white text-slate-800">
    <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[position:68%_top] bg-cover bg-no-repeat md:bg-center" style={{ backgroundImage: "url('/bg.png')" }}/>
    <header className="relative z-30 mx-auto max-w-6xl px-4 pt-5 sm:pt-8">
      <div className="flex min-h-[76px] items-center justify-between gap-4 rounded-2xl bg-white/95 px-5 shadow-[0_12px_35px_rgba(50,72,110,0.09)] sm:px-8">
        <Link href="/" aria-label="TooTee home"><Logo className="text-lg sm:text-xl"/></Link>
        <nav className="hidden items-center gap-7 text-sm font-bold text-slate-600 md:flex lg:gap-10" aria-label="Main navigation">
          <a href="#top" className="hover:text-brand-600">Home</a><a href="#about" className="hover:text-brand-600">About</a><a href="#faqs" className="hover:text-brand-600">FAQs</a><a href="#contact" className="hover:text-brand-600">Contacts</a>
        </nav>
        {user ? <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <div className="relative">
            <button type="button" onClick={() => { setProfileOpen((open) => !open); setNotificationsOpen(false); }} aria-expanded={profileOpen} aria-label="Open profile menu" className="flex items-center gap-2 rounded-xl px-1 py-1 text-slate-600 hover:bg-slate-50 sm:gap-3 sm:px-2">
              <span className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-400">{profile?.photo ? <Image src={profile.photo} alt="" fill unoptimized className="object-cover"/> : <UserRound className="h-6 w-6"/>}</span>
              <span className="hidden max-w-28 truncate text-sm font-bold sm:block">{role === "admin" ? "Admin" : displayName}</span><ChevronDown className="hidden h-4 w-4 sm:block"/>
            </button>
            {profileOpen && <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-700 shadow-xl"><div className="border-b border-slate-100 px-4 py-2"><div className="truncate text-sm font-bold">{displayName}</div><div className="text-xs capitalize text-slate-400">{role === "tutee" ? "Parent / Tutee" : role}</div></div><Link href={`${base}/profile`} onClick={() => setProfileOpen(false)} className="block px-4 py-2.5 text-sm font-semibold hover:bg-brand-50">Profile</Link><button type="button" onClick={() => { setProfileOpen(false); s.logout(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50"><LogOut className="h-4 w-4"/>Log out</button></div>}
          </div>
          <div className="relative">
            <button type="button" onClick={() => { setNotificationsOpen((open) => !open); setProfileOpen(false); }} aria-expanded={notificationsOpen} aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-50"><Bell className="h-5 w-5"/>{unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-coral-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}</button>
            {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div className="font-extrabold text-slate-800">Notifications <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">{unread} new</span></div><button type="button" disabled={!unread} onClick={() => s.markNotificationsRead(user.id)} className="flex items-center gap-1 text-xs font-semibold text-brand-600 disabled:text-slate-300"><CheckCheck className="h-4 w-4"/>Mark all read</button></div><div className="max-h-[min(65vh,26rem)] overflow-y-auto">{userNotifications.length ? userNotifications.map((item) => <Link key={item.id} href={notificationDestination(item, role)} onClick={() => setNotificationsOpen(false)} className={`flex gap-3 border-b border-slate-100 px-4 py-3 hover:bg-brand-50/60 ${!item.read ? "bg-sky-50/60" : ""}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600"><NotificationIcon notification={item} className="h-4 w-4"/></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-5 text-slate-800">{notificationDisplayText(item, s.db)}</span><span className="mt-1 block text-xs text-slate-400">{fmtDateTime(item.at)}</span></span></Link>) : <p className="px-4 py-8 text-center text-sm text-slate-400">You&apos;re all caught up.</p>}</div><Link href={`${base}/notifications`} onClick={() => setNotificationsOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-bold text-brand-600 hover:bg-slate-50">View all notifications</Link></div>}
          </div>
        </div> : s.ready ? <div className="flex shrink-0 gap-2"><Link href="/login"><Button className="min-w-24 rounded-xl px-5">Log in</Button></Link><Link href="/register"><Button variant="secondary" className="min-w-24 rounded-xl border-slate-400 px-5">Register</Button></Link></div> : <div className="h-10 w-28"/>}
      </div>
    </header>

    <main className="relative z-10">
      <section className="mx-auto grid min-h-[390px] max-w-6xl items-center gap-2 px-4 pb-8 pt-10 sm:pt-14 md:min-h-[430px] md:grid-cols-[0.92fr_1.08fr] md:pb-12 md:pt-14">
        <div className="relative z-10 max-w-xl pb-4 md:pb-10">
          <h1 className="text-4xl font-extrabold leading-[1.03] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.35rem]">Where little <span className="text-brand-600">Whizzes</span><br/>grow big.</h1>
          <p className="mt-5 max-w-lg text-base leading-6 text-slate-700 sm:text-lg sm:leading-7">We create a nurturing space where young minds can explore their potential, build confidence, and discover the joy of learning every step of the way.</p>
        </div>
        <div aria-hidden="true" className="min-h-36 md:min-h-72"/>
      </section>

      <section id="programs" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-7 sm:py-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Our Programs</h2>
        <div className="mt-5 grid items-stretch gap-5 md:grid-cols-3 md:gap-7">
          {PROGRAM_DETAILS.map((program) => <article key={program.title} className="rounded-2xl border-2 border-slate-300 bg-white/90 px-6 py-5 transition duration-200 ease-out hover:-translate-y-1 hover:border-brand-300 hover:bg-white hover:shadow-[0_12px_28px_rgba(37,99,235,0.12)] motion-reduce:transition-none sm:px-7 sm:py-6">
            <h3 className="text-xl font-bold text-slate-800">{program.title}</h3><p className="text-sm font-bold text-brand-600">{program.ages}</p>
            <div className="mt-6 space-y-4 text-sm leading-[1.4rem] text-slate-700">{program.sections.map(([heading, description], index) => <p key={`${program.title}-${index}`}>{heading && <><b>{heading}</b><br/></>}{description}</p>)}</div>
          </article>)}
        </div>
      </section>

      <section id="about" className="mx-auto max-w-6xl scroll-mt-28 px-4 py-7 sm:py-10">
        <div className="rounded-2xl bg-brand-600 px-7 py-7 text-white shadow-[0_16px_35px_rgba(37,99,235,0.16)] sm:px-12 sm:py-8"><h2 className="text-2xl font-extrabold sm:text-3xl">About the Center</h2><p className="mt-5 text-base leading-6 sm:text-lg">We are an academic center that offers a range of programs designed to support each student’s unique learning needs.</p><p className="mt-5 text-base leading-6 sm:text-lg">Every program a student enrolls in comes with free access to our licensed US-based interactive online learning platform.</p></div>
      </section>

      <section id="faqs" className="mx-auto max-w-5xl scroll-mt-28 px-4 py-7 sm:py-10">
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Frequently asked questions</h2>
        <div className="mt-5 space-y-3">{HOME_FAQS.map((faq) => <details key={faq.q} className="group rounded-2xl border border-slate-100 bg-white px-5 py-4 shadow-[0_5px_20px_rgba(43,69,110,0.035)]"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-slate-800 marker:hidden">{faq.q}<ChevronDown className="h-4 w-4 shrink-0 transition group-open:rotate-180"/></summary><p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">{faq.a}</p></details>)}</div>
      </section>

      <section id="contact" className="mx-auto max-w-6xl scroll-mt-28 px-4 pb-10 pt-7 sm:pb-14 sm:pt-10">
        <h2 className="mb-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">Contact Us</h2>
        <div className="grid gap-4 rounded-2xl bg-slate-100 px-5 py-5 text-xs font-medium text-slate-700 sm:grid-cols-2 lg:grid-cols-4 lg:items-center lg:gap-3 lg:px-8">
          <div className="flex items-center gap-2"><MapPin className="h-4 w-4 shrink-0 text-brand-600"/><span>{CENTER.address}</span></div>
          <a href={`tel:${CENTER.phone.replace(/[^+\d]/g, "")}`} className="flex items-center gap-2 hover:text-brand-700"><Phone className="h-4 w-4 shrink-0 text-brand-600"/><span>{CENTER.phone}</span></a>
          <a href={`mailto:${CENTER.email}`} className="flex items-center gap-2 hover:text-brand-700"><Mail className="h-4 w-4 shrink-0 text-brand-600"/><span>{CENTER.email}</span></a>
          <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 shrink-0 text-brand-600"/><span>{CENTER.hours}</span></div>
        </div>
      </section>
    </main>
  </div>;
}

"use client";
import { Bell, LoaderCircle, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Logo, cn } from "./ui";
export function homeFor(role) {
    return role === "admin" ? "/admin" : role === "tutor" ? "/tutor" : "/tutee";
}
export function DashboardShell({ role, nav, children, gate }) {
    const s = useStore();
    const router = useRouter();
    const path = usePathname();
    const [open, setOpen] = useState(false);
    useEffect(() => {
        if (!s.ready)
            return;
        if (!s.me)
            router.replace("/login");
        else if (s.me.role !== role)
            router.replace(homeFor(s.me.role));
    }, [s.ready, s.me, role, router]);
    useEffect(() => setOpen(false), [path]);
    if (!s.ready || !s.me || s.me.role !== role) {
        return <div className="grid min-h-screen place-items-center text-slate-400">Loading…</div>;
    }
    const unread = s.db.notifications.filter((n) => n.userId === s.me.id && !n.read).length;
    const name = role === "admin" ? "Administrator" : role === "tutor" ? s.db.tutors.find((t) => t.userId === s.me.id)?.fullName || s.me.username : s.db.tutees.find((t) => t.userId === s.me.id)?.fullName || s.me.username;
    const roleLabel = role === "tutee" ? "Parent / Tutee" : role === "tutor" ? "Tutor" : "Admin";
    const base = homeFor(role);
    const sidebar = (<div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Link href="/">
          <Logo className="text-xl"/>
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {nav.map((n) => {
            const active = n.href === base ? path === base : path.startsWith(n.href);
            return (<Link key={n.href} href={n.href} prefetch className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors duration-150", active ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700")}>
              <span className="h-4 w-4 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {!!n.badge && <span className="rounded-full bg-coral-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{n.badge}</span>}
            </Link>);
        })}
      </nav>
      <div className="border-t border-slate-100 p-4">
        <div className="mb-2 truncate text-sm font-bold">{name}</div>
        <div className="mb-3 text-xs text-slate-400">{roleLabel}</div>
        <button onClick={() => {
            s.logout();
            router.replace("/login");
        }} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">
          <LogOut className="h-4 w-4"/> Log out
        </button>
      </div>
    </div>);
    return (<div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r border-slate-100 bg-white lg:block">{sidebar}</aside>
      {open && (<div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)}/>
          <div className="absolute left-0 top-0 h-full w-64 bg-white shadow-xl">{sidebar}</div>
        </div>)}
      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3 lg:px-8">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
            {open ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}
          </button>
          <div className="flex-1"/>
          {s.actionFeedback !== "idle" && <div role="status" aria-live="polite" className="mr-3 flex items-center gap-2 text-xs font-medium text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin text-brand-600" aria-hidden="true"/>
            {s.actionFeedback === "slow" ? "Saving changes…" : <span className="sr-only">Saving changes</span>}
          </div>}
          <Link href={`${base}/notifications`} className="relative rounded-xl p-2 hover:bg-slate-100" aria-label="Notifications">
            <Bell className="h-5 w-5"/>
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-coral-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
          </Link>
        </header>
        {s.actionFeedback !== "idle" && <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-brand-100" aria-hidden="true"><div className="h-full w-1/3 animate-pulse bg-brand-600"/></div>}
        <main className="mx-auto max-w-6xl space-y-4 p-4 lg:p-8">
          {gate ?? children}
        </main>
      </div>
    </div>);
}

"use client";
import { Bell, CheckCheck, ChevronDown, LoaderCircle, LogOut, Menu, UserRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { cn } from "./ui";
import { Logo } from "./ui";
import { NotificationIcon, notificationDestination, notificationDisplayText } from "./notifications";
import { fmtDateTime } from "@/lib/dates";
export function homeFor(role) {
    return role === "admin" ? "/admin" : role === "tutor" ? "/tutor" : "/tutee";
}
export function DashboardShell({ role, nav, children, gate }) {
    const s = useStore();
    const router = useRouter();
    const path = usePathname();
    const [menuState, setMenuState] = useState({ path, open: false });
    const open = menuState.path === path && menuState.open;
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    useEffect(() => {
      if (!s.me) return;
      let stopped = false;
      const refreshNotifications = async () => {
        if (stopped || document.visibilityState !== "visible") return;
        await s.refreshState(s.me);
      };
      const timer = window.setInterval(() => void refreshNotifications(), 8000);
      document.addEventListener("visibilitychange", refreshNotifications);
      return () => {
        stopped = true;
        window.clearInterval(timer);
        document.removeEventListener("visibilitychange", refreshNotifications);
      };
    }, [s.me, s.refreshState]);
    useEffect(() => {
        if (!s.ready)
            return;
        if (!s.me)
            router.replace("/login");
        else if (s.me.role !== role)
            router.replace(homeFor(s.me.role));
    }, [s.ready, s.me, role, router]);
    if (!s.ready || !s.me || s.me.role !== role) {
        return <div className="grid min-h-screen place-items-center text-slate-400">Loading…</div>;
    }
    const unread = s.db.notifications.filter((n) => n.userId === s.me.id && !n.read).length;
    const notifications = s.db.notifications.filter((n) => n.userId === s.me.id).slice(0, 8);
    const name = role === "admin" ? s.db.adminProfiles?.find((profile) => profile.id === s.me.id)?.fullName || "Administrator" : role === "tutor" ? s.db.tutors.find((t) => t.userId === s.me.id)?.fullName || s.me.username : s.db.tutees.find((t) => t.userId === s.me.id)?.fullName || s.me.username;
    const roleLabel = role === "tutee" ? "Parent / Tutee" : role === "tutor" ? "Tutor" : "Admin";
    const accountLabel = role === "admin" ? "Admin" : name;
    const base = homeFor(role);
    const profilePhoto = role === "admin" ? s.db.adminProfiles?.find((profile) => profile.id === s.me.id)?.photo : role === "tutor" ? s.db.tutors.find((profile) => profile.userId === s.me.id)?.photo : s.db.tutees.find((profile) => profile.userId === s.me.id)?.photo;
    const closeMenu = () => setMenuState({ path, open: false });
    const sidebar = (<div className="flex h-full flex-col">
      <nav className="space-y-1 overflow-y-auto">
        {nav.map((n) => {
            const active = n.href === base ? path === base : path.startsWith(n.href);
            const className = cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-150", active ? "bg-brand-600 text-white shadow-sm" : "text-slate-600 hover:bg-brand-50 hover:text-brand-700");
            const content = <>
              <span className="h-4 w-4 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{n.icon}</span>
              <span className="flex-1">{n.label}</span>
              {!!n.badge && <span className="rounded-full bg-coral-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{n.badge}</span>}
            </>;
            if (n.href === "/tutee/requests") return <a key={n.href} href={n.href} onClick={closeMenu} className={className}>{content}</a>;
            return <Link key={n.href} href={n.href} prefetch onClick={closeMenu} className={className}>{content}</Link>;
        })}
      </nav>
    </div>);
    return (<div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-3">
      <header className="sticky top-3 z-40 mx-auto flex min-h-[76px] w-full max-w-6xl items-center justify-between gap-3 rounded-2xl bg-white/95 px-5 text-slate-600 shadow-[0_12px_35px_rgba(50,72,110,0.09)] sm:px-8">
        <div className="flex shrink-0 items-center gap-2">
          <button className="rounded-lg p-2 hover:bg-slate-100 lg:hidden" onClick={() => setMenuState({ path, open: !open })} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>{open ? <X className="h-5 w-5"/> : <Menu className="h-5 w-5"/>}</button>
          <Link href="/" aria-label="Whizzkids home"><Logo className="text-lg sm:text-xl"/></Link>
        </div>
        <nav className="hidden flex-1 items-center justify-center gap-7 text-sm font-bold text-slate-600 md:flex lg:gap-10" aria-label="Main navigation">
          <Link href="/" className="hover:text-brand-600">Home</Link><Link href="/#about" className="hover:text-brand-600">About</Link><Link href="/#faqs" className="hover:text-brand-600">FAQs</Link><Link href="/#contact" className="hover:text-brand-600">Contacts</Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          {s.actionFeedback !== "idle" && <div role="status" aria-live="polite" className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true"/>{s.actionFeedback === "slow" ? "Saving…" : <span className="sr-only">Saving changes</span>}</div>}
          <div className="relative">
            <button type="button" onClick={() => { setProfileMenuOpen((value) => !value); setNotificationsOpen(false); }} className="flex items-center gap-2 rounded-xl px-1.5 py-1 text-slate-600 hover:bg-slate-50 sm:gap-3 sm:px-2" aria-label="Account menu" aria-expanded={profileMenuOpen}>
              <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-200 text-slate-400">{profilePhoto ? <Image src={profilePhoto} alt="" fill unoptimized className="object-cover"/> : <UserRound className="h-6 w-6 fill-slate-400 stroke-slate-400"/>}</span>
              <span className="hidden max-w-28 truncate text-sm font-bold sm:block">{accountLabel}</span><ChevronDown className="hidden h-4 w-4 sm:block"/>
            </button>
            {profileMenuOpen && <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-slate-700 shadow-xl">
              <div className="border-b border-slate-100 px-4 py-2"><div className="truncate text-sm font-bold">{name}</div><div className="text-xs text-slate-400">{roleLabel}</div></div>
              <Link href={`${base}/profile`} onClick={() => setProfileMenuOpen(false)} className="block px-4 py-2.5 text-sm font-semibold hover:bg-brand-50">Profile</Link>
              <button type="button" onClick={() => { setProfileMenuOpen(false); s.logout(); router.replace("/login"); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-slate-600 hover:bg-slate-50"><LogOut className="h-4 w-4"/>Log out</button>
            </div>}
          </div>
          <div className="relative">
            <button type="button" onClick={() => { setNotificationsOpen((value) => !value); setProfileMenuOpen(false); }} className="relative rounded-xl p-2 text-slate-600 hover:bg-slate-50" aria-label="Notifications" aria-expanded={notificationsOpen}>
              <Bell className="h-5 w-5"/>
              {unread > 0 && <span className="absolute -right-0.5 -top-0.5 rounded-full bg-coral-500 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
            </button>
            {notificationsOpen && <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-1rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div className="font-extrabold text-slate-800">Notifications <span className="ml-1 rounded-full bg-brand-100 px-2 py-0.5 text-xs text-brand-700">{unread} new</span></div>
                <button type="button" disabled={!unread} onClick={() => s.markNotificationsRead(s.me.id)} className="flex items-center gap-1 text-xs font-semibold text-brand-600 disabled:text-slate-300"><CheckCheck className="h-4 w-4"/>Mark all read</button>
              </div>
              <div className="max-h-[min(65vh,26rem)] overflow-y-auto">
                {notifications.length ? notifications.map((n) => <Link key={n.id} href={notificationDestination(n, role)} onClick={() => setNotificationsOpen(false)} className={cn("flex gap-3 border-b border-slate-100 px-4 py-3 hover:bg-brand-50/60", !n.read && "bg-sky-50/60")}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600"><NotificationIcon notification={n} className="h-4 w-4"/></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-5 text-slate-800">{notificationDisplayText(n, s.db)}</span><span className="mt-1 block text-xs text-slate-400">{fmtDateTime(n.at)}</span></span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="Unread"/>}
                </Link>) : <p className="px-4 py-8 text-center text-sm text-slate-400">You&apos;re all caught up.</p>}
              </div>
              <Link href={`${base}/notifications`} onClick={() => setNotificationsOpen(false)} className="block border-t border-slate-100 px-4 py-3 text-center text-sm font-bold text-brand-600 hover:bg-slate-50">View all notifications</Link>
            </div>}
          </div>
        </div>
      </header>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 pt-20 lg:hidden" onClick={closeMenu}><aside className="m-4 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl bg-white p-4 shadow-xl" onClick={(event) => event.stopPropagation()}>{sidebar}</aside></div>}
      {s.actionFeedback !== "idle" && <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-brand-100" aria-hidden="true"><div className="h-full w-1/3 animate-pulse bg-brand-600"/></div>}
      <div className="flex items-start gap-6 py-5 lg:gap-8">
        <aside className="sticky top-24 hidden w-64 shrink-0 self-start rounded-2xl bg-white p-4 shadow-sm lg:block">{sidebar}</aside>
        <main className="min-w-0 flex-1 space-y-4 py-1 sm:py-3">
          {gate ?? children}
        </main>
      </div>
      </div>
    </div>);
}

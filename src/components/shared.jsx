"use client";
import Image from "next/image";
import { Activity, BookOpen, Cake, CalendarDays, CreditCard, FileText, LogIn, MessageCircle, Send, Star, UserRoundCheck } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { DAY_NAMES, firstName, fmtDateTime, fmtTime, MONTH_NAMES } from "@/lib/dates";
import { useStore } from "@/lib/store";
import Link from "next/link";
import { NotificationIcon, notificationDestination, notificationDisplayText } from "./notifications";
import { Badge, Button, Card, Empty, Input, PageHeader, cn } from "./ui";
function hideOtherPartyFullNames(text, userId, db) {
    const role = db.users.find((user) => user.id === userId)?.role;
    const names = role === "tutor"
        ? db.tutees.map((profile) => profile.fullName)
        : role === "tutee"
            ? db.tutors.map((profile) => profile.fullName)
            : [];
    return names
        .filter((name) => name && name.trim().split(/\s+/).length > 1)
        .sort((a, b) => b.length - a.length)
        .reduce((safeText, name) => safeText.replaceAll(name, firstName(name)), text);
}
export function NotificationsView({ userId }) {
    const s = useStore();
    const list = s.db.notifications.filter((n) => n.userId === userId);
    const role = s.db.users.find((user) => user.id === userId)?.role;
    useEffect(() => {
        if (list.some((n) => !n.read)) {
            const t = setTimeout(() => s.markNotificationsRead(userId), 1200);
            return () => clearTimeout(t);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list.length, userId]);
    return (<>
      <PageHeader title="Notifications" subtitle="In-app notifications. Email and SMS channel labels are planned delivery metadata; external messages are not sent."/>
      {list.length === 0 ? (<Empty>You&apos;re all caught up.</Empty>) : (<div className="space-y-2">
          {list.map((n) => (<Link key={n.id} href={notificationDestination(n, role)} className={cn("block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500", !n.read && "") }>
            <Card className={cn("flex items-start gap-3 !p-4 transition hover:border-brand-200 hover:bg-brand-50/30", !n.read && "border-brand-200 bg-brand-50/40")}>
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-600"><NotificationIcon notification={n} className="h-4 w-4"/></div>
              <div className="flex-1">
                <p className="flex items-start gap-2 text-sm">{/^\s*(?:\u{1F382}\s*)?Happy Birthday\b/iu.test(n.text) && <Cake className="mt-0.5 h-4 w-4 shrink-0 text-sunny-600" aria-hidden="true"/>}<span>{notificationDisplayText(n, s.db).replace(/^\s*\u{1F382}\s*/u, "")}</span></p>
                <p className="mt-1 text-xs text-slate-400">{fmtDateTime(n.at)}</p>
              </div>
            </Card>
          </Link>))}
        </div>)}
    </>);
}
function Thread({ threadId, meId, title }) {
    const s = useStore();
    const [text, setText] = useState("");
    const box = useRef(null);
    const msgs = s.db.messages.filter((m) => m.threadId === threadId).slice().sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    useEffect(() => {
        s.markMessageNotificationsRead(meId, threadId);
        // The store API object changes when the DB changes; only re-run when the
        // signed-in user or conversation changes to avoid a read/update loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meId, threadId]);
    useEffect(() => {
        box.current?.scrollTo({ top: box.current.scrollHeight });
    }, [msgs.length, threadId]);
    const send = () => {
        s.sendMessage(threadId, meId, text);
        setText("");
    };
    return (<Card className="flex h-[70vh] flex-col !p-0">
      <div className="border-b border-slate-100 px-5 py-3 font-extrabold">{title}</div>
      <div ref={box} className="flex-1 space-y-2 overflow-y-auto p-4">
        {msgs.length === 0 && <Empty>No messages yet. Say hello!</Empty>}
        {msgs.map((m) => {
            const mine = m.fromId === meId;
            return (<div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[75%] rounded-2xl px-4 py-2 text-sm", mine ? "bg-brand-600 text-white" : m.auto ? "bg-sunny-100 text-slate-800" : "bg-slate-100 text-slate-800")}>
                {m.text}
                <div className={cn("mt-1 text-[10px]", mine ? "text-white/70" : "text-slate-400")}>
                  {fmtDateTime(m.at)}
                  {m.auto ? " · automated" : ""}
                </div>
              </div>
            </div>);
        })}
      </div>
      <form className="flex gap-2 border-t border-slate-100 p-3" onSubmit={(e) => {
            e.preventDefault();
            send();
        }}>
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…"/>
        <Button type="submit" disabled={!text.trim()}>
          <Send className="h-4 w-4"/> Send
        </Button>
      </form>
    </Card>);
}
function conversationTime(value) {
    const date = new Date(value);
    const age = Math.max(0, Date.now() - date.getTime());
    if (age < 24 * 60 * 60 * 1000) return fmtTime(`${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`);
    if (age < 7 * 24 * 60 * 60 * 1000) return DAY_NAMES[date.getDay()];
    return `${MONTH_NAMES[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}
export function ChatView({ meId, isAdmin }) {
    const s = useStore();
    const people = useMemo(() => {
        const applicants = s.db.tutors.filter((tutor) => ["pending_review", "interview", "pending_verification"].includes(tutor.status));
        const activeTutors = s.db.tutors.filter((tutor) => !["pending_review", "interview", "pending_verification"].includes(tutor.status));
        const contacts = [
            ...activeTutors.map((profile) => ({ id: profile.userId, name: profile.fullName, role: "Tutor" })),
            ...s.db.tutees.map((profile) => ({ id: profile.userId, name: profile.fullName, role: "Tutee" })),
            ...applicants.map((profile) => ({ id: profile.userId, name: profile.fullName, role: "Applicant" })),
        ];
        return contacts.map((person) => {
            const latestMessage = s.db.messages.reduce((latest, message) => message.threadId === person.id && (!latest || new Date(message.at) > new Date(latest.at)) ? message : latest, null);
            const unreadCount = s.db.notifications.filter((notification) => notification.userId === meId && !notification.read && notification.text.startsWith("New message") && notification.threadId === person.id).length;
            const account = s.db.users.find((user) => user.id === person.id);
            return { ...person, name: person.name || account?.username || person.role, latestMessage, unreadCount };
        }).sort((a, b) => (new Date(b.latestMessage?.at || 0) - new Date(a.latestMessage?.at || 0)) || a.name.localeCompare(b.name));
    }, [s.db.tutees, s.db.tutors, s.db.users, s.db.messages, s.db.notifications, meId]);
    const [sel, setSel] = useState(null);
    const [roleTab, setRoleTab] = useState("All");
    if (!isAdmin) {
        return (<>
        <PageHeader title="Chat with Admin" subtitle="Messages are delivered instantly to the admin team."/>
        <Thread threadId={meId} meId={meId} title="Whizzkids Admin"/>
      </>);
    }
    const roleTabs = ["All", "Unread"];
    const filteredPeople = people.filter((person) => roleTab === "All" || person.unreadCount > 0);
    const selectedPerson = people.find((person) => person.id === sel);
    const activeId = selectedPerson?.id || null;
    return (<>
      <PageHeader title="Messages" subtitle="Conversations are ordered by latest activity. Each name shows the person’s role."/>
      <div className="grid gap-4 md:grid-cols-[300px_1fr]">
        <Card className="flex max-h-[70vh] min-h-[420px] flex-col !p-2">
          <div className="grid grid-cols-2 gap-1 border-b border-slate-100 p-1">
            {roleTabs.map((tab) => {
              const count = tab === "All" ? people.length : people.filter((person) => person.unreadCount > 0).length;
              return <button key={tab} type="button" onClick={() => { setRoleTab(tab); setSel(null); }} aria-pressed={roleTab === tab} className={cn("flex min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-bold transition", roleTab === tab ? "bg-brand-100 text-brand-800" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}>
                <span>{tab}</span><span className={cn("text-[10px]", tab === "Unread" && count > 0 ? "text-brand-700" : "opacity-70")}>{count}</span>
              </button>;
            })}
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pt-1">
          {filteredPeople.length ? filteredPeople.map((p) => {
            const last = p.latestMessage;
            return (<button key={p.id} onClick={() => setSel(p.id)} className={cn("w-full rounded-xl border px-3 py-2 text-left text-sm", p.unreadCount ? "border-brand-200 bg-brand-50 hover:bg-brand-100" : activeId === p.id ? "border-brand-100 bg-brand-50" : "border-transparent hover:bg-slate-50")}>
                <div className="flex min-w-0 items-center justify-between gap-2 font-bold">
                  <span className="flex min-w-0 items-center gap-2 truncate"><span className={cn("h-2 w-2 shrink-0 rounded-full", p.unreadCount ? "bg-brand-600" : "bg-transparent")}/><span className={p.unreadCount ? "truncate font-extrabold text-slate-900" : "truncate"}>{p.name || "(unnamed)"}</span><span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">{p.role}</span></span>
                  {last && <time dateTime={last.at} className="ml-2 shrink-0 text-[10px] font-medium text-slate-500">{conversationTime(last.at)}</time>}
                </div>
                <div className="mt-1 flex min-w-0 items-center justify-between gap-2 text-xs text-slate-600">
                  <span className="truncate">{last ? `${last.fromId === meId ? "You: " : ""}${last.text}` : "No messages yet"}</span>
                </div>
              </button>);
          }) : <p className="px-3 py-6 text-center text-sm text-slate-400">{roleTab === "Unread" ? "No unread conversations yet." : "No conversations yet."}</p>}
          </div>
        </Card>
        {activeId ? <Thread key={activeId} threadId={activeId} meId={meId} title={selectedPerson.name || "Chat"}/> : <Card className="grid min-h-[420px] place-items-center"><Empty>Select a conversation to begin.</Empty></Card>}
      </div>
    </>);
}
const HISTORY_ACTION_GROUPS = [
    { role: "admin", label: "Admin Actions", actions: [["payments", "Payments"], ["schedule", "Program Schedule"], ["tutor_schedule", "Tutor Schedule"], ["profile", "Profile Updates"], ["chats", "Chats"], ["matches", "Matches"], ["records", "Learning Materials"], ["applications", "Applications"], ["leave", "Leave Requests"], ["logins", "Logins"]] },
    { role: "tutee", label: "Tutee Actions", actions: [["schedule", "Schedule"], ["payments", "Payments"], ["chats", "Chats"], ["records", "Ratings & Records"], ["logins", "Logins"]] },
    { role: "tutor", label: "Tutor Actions", actions: [["leave", "Leave Requests"], ["chats", "Chats"], ["logins", "Logins"], ["matches", "Matches"], ["records", "Records"]] },
    { role: "applicant", label: "Applicant Actions", actions: [["applications", "Applications"], ["chats", "Chats"], ["logins", "Logins"]] },
];
function historyAction(activity) {
    const kind = typeof activity.kind === "string" ? activity.kind : "";
    const text = String(activity.text ?? "").toLowerCase();
    if (kind === "profile" || /updated admin profile/.test(text)) return "profile";
    if (/purchase|order/.test(text)) return "retired_purchase";
    if (/tutor pay|payroll|salary|hourly rate/.test(text)) return "retired_payroll";
    if (/availability|weekly tutor schedule/.test(text)) return "tutor_schedule";
    if (/payment|paid/.test(text)) return "payments";
    if (/leave request|leave submitted/.test(text)) return "leave";
    if (/message|chat/.test(text)) return "chats";
    if (/log(?:ged)? in|login/.test(text)) return "logins";
    if (/application|applicant|interview|registration|verification/.test(text)) return "applications";
    if (kind === "termination") return "termination";
    if (kind === "booking") return "schedule";
    if (kind === "availability") return "tutor_schedule";
    if (kind === "match") return "matches";
    if (["upload", "attendance", "rating"].includes(kind)) return "records";
    if (kind === "other") {
        if (/assessment|record/.test(text)) return "records";
        if (/schedule|reschedul/.test(text)) return "schedule";
    }
    return "other";
}
const HISTORY_ROLES = [
    { id: "all", label: "All Roles" },
    { id: "tutor", label: "Tutors" },
    { id: "tutee", label: "Tutees" },
    { id: "admin", label: "Admins" },
    { id: "applicant", label: "Applicants" },
];
function historyIcon(action) {
    const classes = "mt-0.5 h-4 w-4 shrink-0 text-brand-600";
    if (action === "logins") return <LogIn className={classes} aria-hidden="true"/>;
    if (["schedule", "tutor_schedule", "leave"].includes(action)) return <CalendarDays className={classes} aria-hidden="true"/>;
    if (action === "payments") return <CreditCard className={classes} aria-hidden="true"/>;
    if (action === "chats") return <MessageCircle className={classes} aria-hidden="true"/>;
    if (action === "matches") return <UserRoundCheck className={classes} aria-hidden="true"/>;
    if (action === "applications") return <FileText className={classes} aria-hidden="true"/>;
    if (action === "records") return <Star className={classes} aria-hidden="true"/>;
    if (action === "bookings") return <BookOpen className={classes} aria-hidden="true"/>;
    return <Activity className={classes} aria-hidden="true"/>;
}
function readableHistoryText(value, db) {
    const namesById = new Map();
    for (const profile of [...(db.tutors || []), ...(db.tutees || [])]) {
        if (profile.userId && profile.fullName) namesById.set(profile.userId, profile.fullName);
    }
    for (const profile of db.adminProfiles || []) if (profile.id && profile.fullName) namesById.set(profile.id, profile.fullName);
    for (const user of db.users || []) {
        if (!namesById.has(user.id)) namesById.set(user.id, user.role === "admin" ? "System Admin" : user.username || (user.role === "tutor" ? "Tutor" : user.role === "tutee" ? "Tutee" : "User"));
    }
    const readable = [...namesById.entries()].sort(([a], [b]) => b.length - a.length)
        .reduce((text, [id, name]) => text.split(id).join(name), String(value ?? ""));
    return readable.replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, "a user");
}
function HistoryAvatar({ name, photo }) {
    const [imageFailed, setImageFailed] = useState(false);
    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
    return <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xs font-extrabold text-brand-700" aria-hidden="true">
      {(!photo || imageFailed) && initials}
      {photo && !imageFailed && <Image src={photo} alt="" fill sizes="44px" unoptimized className="object-cover" onError={() => setImageFailed(true)} />}
    </div>;
}
export function HistoryView({ userId, isAdmin }) {
    const s = useStore();
    const [role, setRole] = useState("all");
    const [kind, setKind] = useState("all");
    const [sortOrder, setSortOrder] = useState("newest");
    const roleForUser = (id, activity) => {
        const user = s.db.users.find((entry) => entry.id === id);
        const tutor = s.db.tutors.find((entry) => entry.userId === id);
        if (user?.role === "admin") return "admin";
        if (user?.role === "tutor" && (historyAction(activity ?? {}) === "applications" || ["pending_review", "interview", "pending_verification"].includes(tutor?.status))) return "applicant";
        return user?.role ?? "unknown";
    };
    let list = isAdmin ? s.db.activities : s.db.activities.filter((a) => a.userId === userId);
    if (isAdmin && role !== "all") list = list.filter((a) => roleForUser(a.userId, a) === role);
    // Termination is a retired event and should not appear in the admin history.
    list = list.filter((activity) => !["termination", "retired_purchase", "retired_payroll"].includes(historyAction(activity)));
    const selectedGroup = HISTORY_ACTION_GROUPS.find((group) => group.role === role);
    list = [...list].sort((a, b) => sortOrder === "newest"
        ? new Date(b.at).getTime() - new Date(a.at).getTime()
        : new Date(a.at).getTime() - new Date(b.at).getTime());
    const visibleList = list.filter((activity) => kind === "all" || `${roleForUser(activity.userId, activity)}:${historyAction(activity)}` === kind);
    return (<>
      <PageHeader title="Activity History" subtitle={isAdmin ? "Track bookings, payments, schedules, chats, matches, records, and applications." : "Your bookings, schedules, matches, and records."}/>
      {isAdmin && <Card className="mb-4 flex flex-wrap items-center gap-3 !p-4">
        <span className="mr-auto text-sm font-extrabold text-slate-700">Filter Logs</span>
        <select aria-label="Filter by role" value={role} onChange={(e) => { setRole(e.target.value); setKind("all"); }} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          {HISTORY_ROLES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        <select aria-label="Filter by action" value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <option value="all">All Actions</option>
          {(selectedGroup ? [selectedGroup] : HISTORY_ACTION_GROUPS).map((group) => <optgroup key={group.role} label={group.label}>
            {group.actions.map(([action, label]) => <option key={`${group.role}:${action}`} value={`${group.role}:${action}`}>{label}</option>)}
          </optgroup>)}
        </select>
        <select aria-label="Sort activity" defaultValue="newest" onChange={(e) => setSortOrder(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
          <option value="newest">Newest First</option><option value="oldest">Oldest First</option>
        </select>
      </Card>}
      {visibleList.length === 0 ? (<Empty>No activity yet.</Empty>) : (<ol className="space-y-2">
          {visibleList.map((a) => {
              const actor = s.db.users.find((entry) => entry.id === a.userId);
              const actorRole = roleForUser(a.userId, a);
              const tutor = s.db.tutors.find((entry) => entry.userId === a.userId);
              const tutee = s.db.tutees.find((entry) => entry.userId === a.userId);
              const adminProfile = s.db.adminProfiles?.find((entry) => entry.id === a.userId);
              const actorName = tutor?.fullName || tutee?.fullName || adminProfile?.fullName || (actorRole === "admin" ? "System Admin" : actor?.username || "Unknown User");
              const photo = tutor?.photo || tutee?.photo || adminProfile?.photo || "";
              const action = historyAction(a);
              return (<Card key={a.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 !p-3">
                <HistoryAvatar name={actorName} photo={photo}/>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-slate-800">
                    <span>{actorName}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-600">{actorRole}</span>
                  </p>
                  <p className="mt-1 flex items-start gap-2 text-sm text-slate-700">{historyIcon(action)}<span>{isAdmin ? readableHistoryText(a.text, s.db) : hideOtherPartyFullNames(a.text, userId, s.db)}</span></p>
                </div>
                <span className="whitespace-nowrap text-right text-xs text-slate-500">{fmtDateTime(a.at)}</span>
              </Card>);
          })}
        </ol>)}
    </>);
}

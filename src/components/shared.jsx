"use client";
import { Activity, BookOpen, Cake, CalendarDays, CreditCard, FileText, LogIn, MessageCircle, Send, Star, UserRoundCheck } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { firstName, fmtDateTime } from "@/lib/dates";
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
    const msgs = s.db.messages.filter((m) => m.threadId === threadId);
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
export function ChatView({ meId, isAdmin }) {
    const s = useStore();
    const people = useMemo(() => [
        ...s.db.tutees.map((t) => ({ id: t.userId, name: t.fullName || s.db.users.find((u) => u.id === t.userId)?.username || "Tutee", role: "Tutee" })),
        ...s.db.tutors.map((t) => ({ id: t.userId, name: t.fullName, role: "Tutor" })),
    ], [s.db.tutees, s.db.tutors, s.db.users]);
    const [sel, setSel] = useState(null);
    if (!isAdmin) {
        return (<>
        <PageHeader title="Chat with Admin" subtitle="Messages are delivered instantly to the admin team."/>
        <Thread threadId={meId} meId={meId} title="Whizzkids Admin"/>
      </>);
    }
    const withMsgs = people.filter((p) => s.db.messages.some((m) => m.threadId === p.id));
    const activeId = sel ?? withMsgs[0]?.id ?? people[0]?.id;
    return (<>
      <PageHeader title="Messages" subtitle="Chat with tutees/parents and tutors."/>
      <div className="grid gap-4 md:grid-cols-[260px_1fr]">
        <Card className="max-h-[70vh] space-y-1 overflow-y-auto !p-2">
          {people.map((p) => {
            const last = [...s.db.messages].reverse().find((m) => m.threadId === p.id);
            return (<button key={p.id} onClick={() => setSel(p.id)} className={cn("w-full rounded-xl px-3 py-2 text-left text-sm", activeId === p.id ? "bg-brand-50" : "hover:bg-slate-50")}>
                <div className="flex items-center justify-between font-bold">
                  <span className="truncate">{p.name || "(unnamed)"}</span>
                  <Badge status={p.role === "Tutor" ? "online" : "face-to-face"}>{p.role}</Badge>
                </div>
                <div className="mt-0.5 truncate text-xs text-slate-400">{last?.text || "No messages"}</div>
              </button>);
        })}
        </Card>
        {activeId ? <Thread threadId={activeId} meId={meId} title={people.find((p) => p.id === activeId)?.name || "Chat"}/> : <Empty>No users yet.</Empty>}
      </div>
    </>);
}
const HISTORY_ACTION_GROUPS = [
    { role: "admin", label: "Admin Actions", actions: [["payments", "Payments"], ["schedule", "Program Schedule"], ["tutor_schedule", "Tutor Schedule"], ["chats", "Chats"], ["matches", "Matches"], ["records", "Records"], ["applications", "Applications"], ["leave", "Leave Requests"], ["logins", "Logins"]] },
    { role: "tutee", label: "Tutee Actions", actions: [["schedule", "Schedule"], ["payments", "Payments"], ["chats", "Chats"], ["records", "Ratings & Records"], ["logins", "Logins"]] },
    { role: "tutor", label: "Tutor Actions", actions: [["leave", "Leave Requests"], ["chats", "Chats"], ["logins", "Logins"], ["matches", "Matches"], ["records", "Records"]] },
    { role: "applicant", label: "Applicant Actions", actions: [["applications", "Applications"], ["chats", "Chats"], ["logins", "Logins"]] },
];
function historyAction(activity) {
    const kind = typeof activity.kind === "string" ? activity.kind : "";
    const text = String(activity.text ?? "").toLowerCase();
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
              const actorName = tutor?.fullName || tutee?.fullName || (actorRole === "admin" ? "System Admin" : actor?.username || "Unknown User");
              const photo = tutor?.photo || tutee?.photo || "";
              const initials = actorName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
              const action = historyAction(a);
              return (<Card key={a.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] items-center gap-3 !p-3">
                <div className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-full border border-slate-200 bg-slate-50 text-xs font-extrabold text-brand-700" aria-hidden="true">
                  {initials}{photo && <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />}
                </div>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-slate-800">
                    <span>{actorName}</span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-slate-600">{actorRole}</span>
                  </p>
                  <p className="mt-1 flex items-start gap-2 text-sm text-slate-700">{historyIcon(action)}<span>{isAdmin ? a.text : hideOtherPartyFullNames(a.text, userId, s.db)}</span></p>
                </div>
                <span className="whitespace-nowrap text-right text-xs text-slate-500">{fmtDateTime(a.at)}</span>
              </Card>);
          })}
        </ol>)}
    </>);
}

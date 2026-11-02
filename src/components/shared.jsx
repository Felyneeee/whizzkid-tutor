"use client";
import { Mail, MessageSquare, Smartphone, Send } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { firstName, fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
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
          {list.map((n) => (<Card key={n.id} className={cn("flex items-start gap-3 !p-4", !n.read && "border-brand-200 bg-brand-50/40")}>
              <div className="flex-1">
                <p className="text-sm">{hideOtherPartyFullNames(n.text, userId, s.db)}</p>
                <p className="mt-1 text-xs text-slate-400">{fmtDateTime(n.at)}</p>
              </div>
              <div className="flex gap-1 text-slate-400" title="Delivered via">
                {n.channels.includes("web") && <MessageSquare className="h-4 w-4" aria-label="Web"/>}
                {n.channels.includes("email") && <Mail className="h-4 w-4" aria-label="Email (mock)"/>}
                {n.channels.includes("sms") && <Smartphone className="h-4 w-4" aria-label="SMS (mock)"/>}
              </div>
            </Card>))}
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
const KINDS = ["all", "booking", "match", "attendance", "rating", "upload", "termination"];
export function HistoryView({ userId, isAdmin }) {
    const s = useStore();
    const [kind, setKind] = useState("all");
    let list = isAdmin ? s.db.activities : s.db.activities.filter((a) => a.userId === userId);
    if (kind !== "all")
        list = list.filter((a) => a.kind === kind);
    return (<>
      <PageHeader title="Activity History" subtitle={isAdmin ? "Ratings, matches, uploads, terminated contracts and bookings." : "Your matches, uploads, ratings and terminated contracts."}/>
      <div className="mb-4 flex flex-wrap gap-2">
        {KINDS.map((k) => (<button key={k} onClick={() => setKind(k)} className={cn("rounded-full border px-3 py-1 text-xs font-bold capitalize", kind === k ? "border-brand-500 bg-brand-500 text-white" : "border-slate-200 bg-white text-slate-500")}>
            {k}
          </button>))}
      </div>
      {list.length === 0 ? (<Empty>No activity yet.</Empty>) : (<ol className="space-y-2">
          {list.map((a) => (<Card key={a.id} className="flex items-center gap-3 !p-3">
              <Badge status={a.kind === "termination" ? "terminated" : a.kind === "rating" ? "approved" : "booked"}>{a.kind}</Badge>
              <span className="flex-1 text-sm">{isAdmin ? a.text : hideOtherPartyFullNames(a.text, userId, s.db)}</span>
              <span className="text-xs text-slate-400">{fmtDateTime(a.at)}</span>
            </Card>))}
        </ol>)}
    </>);
}

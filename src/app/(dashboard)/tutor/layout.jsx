"use client";
import { Bell, CalendarCheck, CalendarDays, CalendarOff, FileLock2, History, Home, MessageCircle, UserRound, Users } from "lucide-react";
import { usePathname } from "next/navigation";
import { DashboardShell } from "@/components/Shell";
import { Alert, Badge, Card } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
const OPEN = ["/tutor/profile", "/tutor/notifications", "/tutor/chat"];
export default function TutorLayout({ children }) {
    const s = useStore();
    const path = usePathname();
    const id = s.me?.id;
    const t = s.db.tutors?.find((x) => x.userId === id);
    const unread = s.db.notifications?.filter((n) => n.userId === id && !n.read).length ?? 0;
    const unreadMessages = s.db.notifications?.filter((n) => n.userId === id && !n.read && n.text.startsWith("New message")).length ?? 0;
    const active = t?.status === "active";
    const gated = !active && !OPEN.some((p) => path.startsWith(p));
    const full = [
        { href: "/tutor", label: "Dashboard", icon: <Home /> },
        { href: "/tutor/calendar", label: "My Calendar", icon: <CalendarDays /> },
        { href: "/tutor/students", label: "My Students", icon: <Users /> },
        { href: "/tutor/leave", label: "Leave Requests", icon: <CalendarOff />, badge: s.db.leaves?.filter((l) => l.tutorId === id && l.status === "pending").length ?? 0 },
        { href: "/tutor/materials", label: "Learning Materials", icon: <FileLock2 /> },
        { href: "/tutor/chat", label: "Chat with Admin", icon: <MessageCircle />, badge: unreadMessages },
        { href: "/tutor/history", label: "Activity History", icon: <History /> },
        { href: "/tutor/notifications", label: "Notifications", icon: <Bell />, badge: unread },
        { href: "/tutor/profile", label: "My Profile", icon: <UserRound /> },
    ];
    const limited = [
        { href: "/tutor", label: "Dashboard", icon: <Home /> },
        { href: "/tutor/chat", label: "Chat with Admin", icon: <MessageCircle />, badge: unreadMessages },
        { href: "/tutor/notifications", label: "Notifications", icon: <Bell />, badge: unread },
        { href: "/tutor/profile", label: "My Profile", icon: <UserRound /> },
    ];
    const gate = t ? (<div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-extrabold">Application status</h1>
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold">{t.fullName}</span>
          <Badge status={t.status}/>
        </div>
        {t.status === "pending_review" && <Alert kind="warn">Your application is waiting for admin review. You&apos;ll be notified if you&apos;re invited for an interview.</Alert>}
        {t.status === "interview" && (<Alert kind="info">
            Interview scheduled: <b>{t.interviewAt ? fmtDateTime(t.interviewAt) : "TBA"}</b>. {t.interviewNotes}
          </Alert>)}
        {t.status === "pending_verification" && <Alert kind="warn">Your registration is pending verification by the admin.</Alert>}
        {t.status === "rejected" && <Alert kind="error">Your application was not approved. {t.rejectionReason}</Alert>}
      </Card>
    </div>) : null;
    return (<DashboardShell role="tutor" nav={active ? full : limited} gate={gated ? gate : undefined}>
      {children}
    </DashboardShell>);
}

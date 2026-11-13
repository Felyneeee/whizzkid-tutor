"use client";
import { Bell, CalendarCheck, CalendarClock, ClipboardCheck, FileLock2, GraduationCap, History, Home, MessageCircle, ShoppingBag, Shuffle, Users, Baby, TrendingUp, } from "lucide-react";
import { DashboardShell } from "@/components/Shell";
import { useStore } from "@/lib/store";
export default function AdminLayout({ children }) {
    const s = useStore();
    const db = s.db;
    const apps = db.tutors?.filter((t) => ["pending_review", "interview", "pending_verification"].includes(t.status)).length ?? 0;
    const matching = db.bookings?.filter((b) => ["awaiting_admin", "ready_for_matching"].includes(b.status)).length ?? 0;
    const approvals = (db.availability ? new Set(db.availability.filter((a) => a.status === "pending").map((a) => a.batchId)).size : 0) + (db.leaves?.filter((l) => l.status === "pending" && l.tutorId !== s.me?.id).length ?? 0);
    const conflicts = db.sessions?.filter((x) => x.status === "needs_reassignment").length ?? 0;
    const orders = db.purchases?.filter((p) => p.status === "pending").length ?? 0;
    const unread = db.notifications?.filter((n) => n.userId === s.me?.id && !n.read).length ?? 0;
    const unreadMessages = db.notifications?.filter((n) => n.userId === s.me?.id && !n.read && n.text.startsWith("New message")).length ?? 0;
    const assessments = db.assessments?.filter((a) => a.status === "booked").length ?? 0;
    return (<DashboardShell role="admin" nav={[
            { href: "/admin", label: "Dashboard", icon: <Home /> },
            { href: "/admin/applications", label: "Tutor Applications", icon: <ClipboardCheck />, badge: apps },
            { href: "/admin/matching", label: "Matching", icon: <Shuffle />, badge: matching },
            { href: "/admin/scheduling", label: "Scheduling & Contracts", icon: <CalendarClock />, badge: conflicts },
            { href: "/admin/approvals", label: "Availability & Leaves", icon: <CalendarCheck />, badge: approvals },
            { href: "/admin/assessments", label: "Reading Assessments", icon: <GraduationCap />, badge: assessments },
            { href: "/admin/progress", label: "Student Progress", icon: <TrendingUp /> },
            { href: "/admin/classes", label: "Playgroup Classes", icon: <Baby /> },
            { href: "/admin/users", label: "Tutee & Tutor Records", icon: <Users /> },
            { href: "/admin/materials", label: "Learning Materials", icon: <FileLock2 /> },
            { href: "/admin/orders", label: "Purchases", icon: <ShoppingBag />, badge: orders },
            { href: "/admin/chat", label: "Messages", icon: <MessageCircle />, badge: unreadMessages },
            { href: "/admin/history", label: "Activity History", icon: <History /> },
            { href: "/admin/notifications", label: "Notifications", icon: <Bell />, badge: unread },
        ]}>
      {children}
    </DashboardShell>);
}

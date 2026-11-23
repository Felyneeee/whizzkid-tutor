"use client";
import { CalendarDays, ClipboardList, FileLock2, History, Home, MessageCircle, CreditCard, Users, Baby } from "lucide-react";
import { DashboardShell } from "@/components/Shell";
import { useStore } from "@/lib/store";
export default function AdminLayout({ children }) {
    const s = useStore();
    const db = s.db;
    const apps = db.tutors?.filter((t) => ["pending_review", "interview", "pending_verification"].includes(t.status)).length ?? 0;
    const matching = (db.bookings?.filter((b) => ["awaiting_admin", "ready_for_matching"].includes(b.status)).length ?? 0) + (db.bookings?.filter((b) => b.rescheduleProposal).length ?? 0);
    const approvals = db.leaves?.filter((l) => l.status === "pending" && l.tutorId !== s.me?.id).length ?? 0;
    const conflicts = db.sessions?.filter((x) => x.status === "needs_reassignment").length ?? 0;
    const payments = db.bookings?.filter((b) => b.status === "awaiting_payment_approval").length ?? 0;
    const unreadMessages = db.notifications?.filter((n) => n.userId === s.me?.id && !n.read && n.text.startsWith("New message")).length ?? 0;
    const assessments = db.assessments?.filter((a) => ["booked", "pending_admin_scheduling"].includes(a.status)).length ?? 0;
    return (<DashboardShell role="admin" nav={[
            { href: "/admin", label: "Dashboard", icon: <Home /> },
            { href: "/admin/tutors", label: "Tutor", icon: <Users />, badge: apps + approvals },
            { href: "/admin/booking-requests", label: "Booking Requests", icon: <ClipboardList />, badge: matching + assessments },
            { href: "/admin/scheduling", label: "Calendar", icon: <CalendarDays />, badge: conflicts },
            { href: "/admin/users", label: "Tutee Records", icon: <Baby /> },
            { href: "/admin/materials", label: "Learning Materials", icon: <FileLock2 /> },
            { href: "/admin/orders", label: "Booking Payments", icon: <CreditCard />, badge: payments },
            { href: "/admin/chat", label: "Messages", icon: <MessageCircle />, badge: unreadMessages },
            { href: "/admin/history", label: "Activity History", icon: <History /> },
        ]}>
      {children}
    </DashboardShell>);
}

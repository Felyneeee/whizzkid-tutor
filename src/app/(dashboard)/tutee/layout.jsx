"use client";
import { CalendarDays, Clock, Home, MessageCircle, UserRound, History, Sparkles } from "lucide-react";
import { DashboardShell } from "@/components/Shell";
import { useStore } from "@/lib/store";
export default function TuteeLayout({ children }) {
    const s = useStore();
    const id = s.me?.id;
    const pending = s.db.bookings?.filter((b) => b.tuteeId === id && (["pending_assessment", "assessment_scheduled", "ready_for_matching", "awaiting_admin", "to_pay", "awaiting_payment_approval"].includes(b.status) || (b.program === "reading" && b.status === "pending") || !!b.scheduleProposal || !!b.rescheduleProposal)).length ?? 0;
    const unreadMessages = s.db.notifications?.filter((n) => n.userId === id && !n.read && n.text.startsWith("New message")).length ?? 0;
    return (<DashboardShell role="tutee" nav={[
            { href: "/tutee", label: "Dashboard", icon: <Home /> },
            { href: "/tutee/profile", label: "Child Profile", icon: <UserRound /> },
            { href: "/tutee/book", label: "Book a Program", icon: <Sparkles /> },
            { href: "/tutee/requests", label: "My Bookings", icon: <Clock />, badge: pending },
            { href: "/tutee/schedule", label: "My Schedule", icon: <CalendarDays /> },
            { href: "/tutee/chat", label: "Chat with Admin", icon: <MessageCircle />, badge: unreadMessages },
            { href: "/tutee/history", label: "Activity History", icon: <History /> },
        ]}>
      {children}
    </DashboardShell>);
}

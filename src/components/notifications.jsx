import { Bell, CalendarDays, CreditCard, FileText, MessageCircle, UserRoundCheck } from "lucide-react";

export function notificationDestination(notification, role) {
  const text = String(notification.text || "").toLowerCase();
  const base = role === "admin" ? "/admin" : role === "tutor" ? "/tutor" : "/tutee";
  if (/new message/.test(text)) return role === "admin" ? "/admin/chat" : `${base}/chat`;
  if (/payment|receipt|reservation|paid/.test(text)) return role === "admin" ? "/admin/payments" : `${base}/requests`;
  if (/leave request|leave/.test(text)) return role === "admin" ? "/admin/tutors" : role === "tutor" ? "/tutor/leave" : "/tutee/requests";
  if (/assessment|reading/.test(text)) return role === "admin" ? "/admin/booking-requests" : `${base}/requests`;
  if (/reassign|reassigned|booking|reschedul|tutor was matched|reservation/.test(text)) return role === "admin" ? "/admin/booking-requests" : role === "tutor" ? "/tutor/calendar" : "/tutee/requests";
  if (/schedule|session/.test(text)) return role === "admin" ? "/admin/scheduling" : role === "tutor" ? "/tutor/calendar" : "/tutee/schedule";
  if (/application|registration|interview/.test(text)) return role === "admin" ? "/admin/tutors" : `${base}/profile`;
  return `${base}/notifications`;
}

export function notificationDisplayText(notification, db) {
  let text = String(notification.text || "");
  text = text.replace(/^(New message from )System$/i, "$1Admin");
  const names = new Map();
  for (const user of db.users || []) {
    const profile = user.role === "tutor"
      ? db.tutors?.find((entry) => entry.userId === user.id)
      : user.role === "tutee"
        ? db.tutees?.find((entry) => entry.userId === user.id)
        : null;
    names.set(user.id, profile?.fullName || user.username || (user.role === "admin" ? "Admin" : user.role === "tutor" ? "Tutor" : "Tutee"));
  }
  for (const [id, name] of [...names.entries()].sort(([a], [b]) => b.length - a.length)) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`(^|[^\\w-])${escapedId}(?=$|[^\\w-])`, "g"), (_match, prefix) => `${prefix}${name}`);
  }
  return text.replace(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/gi, "a user");
}

export function NotificationIcon({ notification, className = "" }) {
  const text = String(notification.text || "").toLowerCase();
  const Icon = /new message/.test(text) ? MessageCircle
    : /payment|receipt|reservation|paid/.test(text) ? CreditCard
      : /leave|schedule|session|reschedul/.test(text) ? CalendarDays
        : /assessment|reading|booking|matched/.test(text) ? UserRoundCheck
          : /application|registration|interview/.test(text) ? FileText : Bell;
  return <Icon className={className} aria-hidden="true" />;
}

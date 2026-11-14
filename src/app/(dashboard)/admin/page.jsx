"use client";
import { useState } from "react";
import { BadgeCheck, Clock3, GraduationCap, UsersRound } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { HOURS } from "@/lib/constants";
import { todayISO } from "@/lib/dates";
import { useStore } from "@/lib/store";

const palette = { academic: "#2563eb", reading: "#ffb800", playgroup: "#3f3f46" };
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Panel({ title, children, className = "" }) {
  return <Card className={`overflow-hidden rounded-xl border-0 bg-white p-4 !shadow-[0_8px_24px_rgba(15,23,42,.26)] ${className}`}>
    <h2 className="mb-3 text-sm font-extrabold text-slate-800">{title}</h2>{children}
  </Card>;
}

function Donut({ values, labels }) {
  const [selected, setSelected] = useState(null);
  const total = values.reduce((sum, item) => sum + item.value, 0);
  const colors = ["#65a72f", "#f7d978", "#ef4444", "#c9cdd2"];
  let angle = 0;
  return <div className="grid min-h-[186px] grid-cols-[1fr_150px_1fr] items-center gap-1">
    <div className="space-y-3 text-right">{labels.slice(0, 2).map((item) => <div key={item.label} className="text-[10px] leading-tight text-slate-600">{item.label}<br/><b>{item.value} · {item.percent}%</b></div>)}</div>
    <svg viewBox="0 0 120 120" className="mx-auto h-36 w-36" role="img" aria-label="Booking status breakdown">
      {total ? values.map((item, index) => {
        const sweep = item.value / total * 359.99;
        const start = angle - 90;
        const end = angle + sweep - 90;
        angle += sweep;
        const point = (degrees, radius) => [60 + radius * Math.cos(degrees * Math.PI / 180), 60 + radius * Math.sin(degrees * Math.PI / 180)];
        const [x1, y1] = point(start, 48), [x2, y2] = point(end, 48), [x3, y3] = point(end, 24), [x4, y4] = point(start, 24);
        const path = `M ${x1} ${y1} A 48 48 0 ${sweep > 180 ? 1 : 0} 1 ${x2} ${y2} L ${x3} ${y3} A 24 24 0 ${sweep > 180 ? 1 : 0} 0 ${x4} ${y4} Z`;
        const detail = `${item.label}: ${item.value} bookings (${Math.round(item.value / total * 100)}%)`;
        const toggle = () => setSelected((current) => current === detail ? null : detail);
        return <path key={item.label} d={path} fill={colors[index]} stroke="#f8fbfd" strokeWidth="1" role="button" tabIndex="0" onClick={toggle} onKeyDown={(event) => event.key === "Enter" && toggle()}><title>{`${item.label}: ${item.value} (${Math.round(item.value / total * 100)}%)`}</title></path>;
      }) : <circle cx="60" cy="60" r="36" fill="none" stroke="#e2e8f0" strokeWidth="24"><title>No booking data</title></circle>}
    </svg>
    <div className="space-y-3 text-[10px] leading-tight text-slate-600">{labels.slice(2).map((item) => <div key={item.label}>{item.label}<br/><b>{item.value} · {item.percent}%</b></div>)}{selected && <div className="col-span-3 text-center text-[10px] font-bold text-slate-700">{selected}</div>}</div>
  </div>;
}

function MonthlyTrend({ data }) {
  const [selected, setSelected] = useState(null);
  const width = 760, height = 185, left = 34, right = 12, top = 8, bottom = 24;
  const max = Math.max(1, ...data.map((item) => item.value));
  const x = (index) => left + index * (width - left - right) / Math.max(1, data.length - 1);
  const y = (value) => top + (max - value) / max * (height - top - bottom);
  const points = data.map((item, index) => `${x(index)},${y(item.value)}`).join(" ");
  return <div className="w-full overflow-x-auto"><svg viewBox={`0 0 ${width} ${height}`} className="h-[185px] min-w-[560px] w-full" role="img" aria-label="Monthly sessions trend">
    {[0, .25, .5, .75, 1].map((fraction) => { const value = Math.round(max * fraction); const yy = y(value); return <g key={fraction}><line x1={left} x2={width - right} y1={yy} y2={yy} stroke="#dce3ea" strokeDasharray="3 4"/><text x={left - 7} y={yy + 3} textAnchor="end" fontSize="9" fill="#64748b">{value}</text></g>; })}
    <polygon points={`${left},${height - bottom} ${points} ${width - right},${height - bottom}`} fill="#8db4ff" opacity=".18"/>
    <polyline points={points} fill="none" stroke="#4e8bff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
    {data.map((item, index) => { const detail = `${item.label}: ${item.value} sessions`; const toggle = () => setSelected((current) => current === detail ? null : detail); return <g key={item.label}><circle cx={x(index)} cy={y(item.value)} r="5" fill="#4e8bff" role="button" tabIndex="0" onClick={toggle} onKeyDown={(event) => event.key === "Enter" && toggle()}><title>{detail}</title></circle><text x={x(index)} y={height - 5} textAnchor="middle" fontSize="9" fill="#475569">{item.label}</text></g>; })}
  </svg>{selected && <div className="w-full text-center text-xs font-bold text-slate-700">{selected}</div>}</div>;
}

export default function AdminHome() {
  const { db } = useStore();
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedSlots, setSelectedSlots] = useState("");
  const [selectedTutor, setSelectedTutor] = useState("");
  const sessions = db.sessions ?? [];
  const bookings = db.bookings ?? [];
  const approved = sessions.filter((session) => ["scheduled", "completed"].includes(session.status));
  const pending = bookings.filter((booking) => ["pending_assessment", "assessment_scheduled", "awaiting_admin", "ready_for_matching"].includes(booking.status));
  const thisWeek = (date) => {
    const monday = new Date(`${todayISO()}T12:00:00`);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    const weekEnd = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, "0")}-${String(sunday.getDate()).padStart(2, "0")}`;
    const dateOnly = String(date ?? "").slice(0, 10);
    return dateOnly >= weekStart && dateOnly <= weekEnd;
  };
  const statuses = [
    { label: "Approved", value: bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).length },
    { label: "Pending", value: pending.length },
    { label: "Declined", value: bookings.filter((b) => b.status === "rejected").length },
    { label: "Cancelled", value: bookings.filter((b) => b.status === "cancelled").length },
  ];
  const statusLabels = statuses.map((item) => ({ ...item, percent: bookings.length ? Math.round(item.value / bookings.length * 100) : 0 }));
  const now = new Date(`${todayISO()}T12:00:00`);
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { label: months[date.getMonth()], value: sessions.filter((session) => session.date?.startsWith(key) && ["scheduled", "completed"].includes(session.status)).length };
  });
  const programs = ["academic", "reading", "playgroup"].map((program) => ({
    program,
    value: bookings.filter((booking) => booking.program === program && booking.status !== "rejected").length,
  }));
  const maxProgram = Math.max(1, ...programs.map((item) => item.value));
  const tutorRows = (db.tutors ?? []).map((tutor) => {
    const assigned = sessions.filter((session) => session.tutorId === tutor.userId && session.date?.startsWith(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`) && ["scheduled", "completed"].includes(session.status));
    return { tutor, counts: ["academic", "reading", "playgroup"].map((program) => assigned.filter((session) => bookings.find((booking) => booking.id === session.bookingId)?.program === program).length) };
  }).sort((a, b) => b.counts.reduce((sum, n) => sum + n, 0) - a.counts.reduce((sum, n) => sum + n, 0)).slice(0, 6);
  const maxTutor = Math.max(1, ...tutorRows.map((row) => row.counts.reduce((sum, n) => sum + n, 0)));
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const slots = weekdays.map((label, index) => {
    const day = index + 1;
    const tutors = (db.tutors ?? []).filter((tutor) => tutor.status === "active");
    const occurrences = new Map();
    tutors.forEach((tutor) => {
      const schedule = db.tutorSchedules?.[tutor.userId];
      if (schedule) {
        if (schedule.days?.[weekdayNames[day]]) HOURS.forEach((time) => occurrences.set(`${tutor.userId}|weekly|${time}`, { tutorId: tutor.userId, time }));
        return;
      }
      (db.availability ?? []).filter((entry) => entry.tutorId === tutor.userId && entry.status === "approved" && entry.date >= todayISO() && new Date(`${entry.date}T12:00:00`).getDay() === day)
        .forEach((entry) => (entry.slots ?? []).forEach((time) => occurrences.set(`${tutor.userId}|${entry.date}|${time}`, { tutorId: tutor.userId, date: entry.date, time })));
    });
    let booked = 0;
    let open = 0;
    occurrences.forEach(({ tutorId, date, time }) => {
      const occupying = sessions.filter((session) => session.tutorId === tutorId && session.time === time && (!date || session.date === date) && new Date(`${session.date}T12:00:00`).getDay() === day && ["scheduled", "needs_reassignment", "completed"].includes(session.status));
      const groupOccupants = occupying.filter((session) => db.bookings?.find((booking) => booking.id === session.bookingId)?.sessionType === "group");
      booked += occupying.length;
      open += groupOccupants.length === 1 ? 1 : occupying.length === 0 ? 1 : 0;
    });
    return { label, open, booked };
  });
  const maxSlots = Math.max(1, ...slots.flatMap((item) => [item.open, item.booked]));
  const metrics = [
    { label: "Total Tutees", value: db.tutees?.length ?? 0, weekly: (db.users ?? []).filter((user) => user.role === "tutee" && thisWeek(user.createdAt)).length, color: "bg-[#dbe8f7] text-[#4e83eb]", icon: <GraduationCap/> },
    { label: "Total Tutors", value: db.tutors?.length ?? 0, weekly: (db.users ?? []).filter((user) => user.role === "tutor" && thisWeek(user.createdAt)).length, color: "bg-[#fbefc9] text-[#e5b923]", icon: <UsersRound/> },
    { label: "Approved Sessions", value: approved.length, weekly: approved.filter((session) => thisWeek(session.date)).length, color: "bg-[#dceccd] text-[#65a72f]", icon: <BadgeCheck/> },
    { label: "Pending Requests", value: pending.length, weekly: pending.filter((booking) => thisWeek(booking.createdAt)).length, color: "bg-[#e1e1e1] text-[#747474]", icon: <Clock3/> },
  ];
  return <div className="-mx-2 space-y-5 rounded-2xl bg-white p-4 sm:-mx-4 sm:p-6">
    <PageHeader title={<>Admin <span className="text-brand-600">Dashboard</span></>}/>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{metrics.map((metric) => <div key={metric.label} className={`rounded-xl p-4 shadow-[0_5px_18px_rgba(15,23,42,.14)] ${metric.color}`}><div className="mb-1 [&>svg]:h-6 [&>svg]:w-6">{metric.icon}</div><div className="text-sm font-extrabold">{metric.label}</div><div className="text-2xl font-extrabold leading-tight">{metric.value}</div><div className="mt-1 text-xs font-semibold opacity-80">+{metric.weekly} this week</div></div>)}</div>
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Booking Status"><Donut values={statuses} labels={statusLabels}/></Panel>
      <Panel title="Enrollment per Program"><div className="flex min-h-[186px] items-center"><div className="w-full space-y-3">{programs.map((item) => { const detail = `${item.program}: ${item.value} bookings`; return <div key={item.program} className="grid grid-cols-[70px_1fr_28px] items-center gap-2 text-[10px]"><span className="capitalize text-slate-600">{item.program}</span><div className="h-8 bg-slate-100"><button type="button" onClick={() => setSelectedProgram((current) => current === detail ? "" : detail)} title={detail} className="block h-full rounded-r-md" style={{ width: `${item.value / maxProgram * 100}%`, minWidth: item.value ? 3 : 0, background: palette[item.program] }}/></div><b className="text-right">{item.value}</b></div>; })}</div></div>{selectedProgram && <div className="mt-2 w-full text-center text-xs font-bold text-slate-700">{selectedProgram}</div>}</Panel>
    </div>
    <Panel title="Monthly Booking Trends" className="bg-gradient-to-br from-[#f4efd7] to-[#dbe7ff]"><MonthlyTrend data={monthly}/></Panel>
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel title="Number of Slots"><div className="flex h-[190px] items-end gap-3 px-1">{slots.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1"><div className="flex h-[145px] w-full items-end justify-center gap-1">{[[`${item.label}: ${item.open} unbooked slots`, item.open, "bg-[#2563eb]"], [`${item.label}: ${item.booked} booked slots`, item.booked, "bg-[#ffb800]"]].map(([detail, count, color], index) => <button type="button" key={index} onClick={() => setSelectedSlots((current) => current === detail ? "" : detail)} title={detail} aria-label={detail} className={`w-1/3 rounded-t ${color}`} style={{ height: `${count / maxSlots * 100}%`, minHeight: count ? 3 : 0 }}/>)}</div><span className="text-[9px] text-slate-600">{item.label}</span></div>)}</div><div className="mt-2 flex justify-center gap-4 text-[9px] text-slate-600"><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600"/>Unbooked</span><span><i className="mr-1 inline-block h-2 w-2 rounded-full bg-amber-400"/>Booked</span></div>{selectedSlots && <div className="mt-2 w-full text-center text-xs font-bold text-slate-700">{selectedSlots}</div>}</Panel>
      <Panel title="Monthly Sessions per Tutor"><div className="flex min-h-[190px] items-end gap-2 overflow-x-auto px-1">{tutorRows.length ? tutorRows.map(({ tutor, counts }) => <div key={tutor.userId} className="flex h-[170px] min-w-9 flex-1 flex-col items-center justify-end gap-1"><div className="flex h-[135px] w-full items-end justify-center"><div className="flex w-5/6 flex-col-reverse overflow-hidden rounded-t" style={{ height: `${counts.reduce((sum, n) => sum + n, 0) / maxTutor * 100}%`, minHeight: counts.some(Boolean) ? 3 : 0 }}>{counts.map((count, index) => { const detail = `${tutor.fullName} · ${["Academic", "Reading", "Playgroup"][index]}: ${count} sessions this month`; return <button type="button" key={index} onClick={() => setSelectedTutor((current) => current === detail ? "" : detail)} title={`${tutor.fullName} · ${["Academic", "Reading", "Playgroup"][index]}: ${count} sessions`} aria-label={`${tutor.fullName} · ${["Academic", "Reading", "Playgroup"][index]}: ${count} sessions`} style={{ height: `${count / Math.max(1, counts.reduce((sum, n) => sum + n, 0)) * 100}%`, minHeight: count ? 3 : 0, background: [palette.academic, palette.reading, palette.playgroup][index] }}/>})}</div></div><span className="max-w-12 truncate text-[8px] text-slate-600" title={tutor.fullName}>{tutor.fullName?.split(" ")[0] || "Tutor"}</span></div>) : <div className="grid h-[170px] w-full place-items-center text-xs text-slate-400">No tutor session data yet</div>}</div><div className="mt-1 flex justify-center gap-3 text-[9px] text-slate-600">{["Academic", "Reading", "Playgroup"].map((name, i) => <span key={name}><i className="mr-1 inline-block h-2 w-2 rounded-full" style={{ background: [palette.academic, palette.reading, palette.playgroup][i] }}/>{name}</span>)}</div>{selectedTutor && <div className="mt-2 w-full text-center text-xs font-bold text-slate-700">{selectedTutor}</div>}</Panel>
    </div>
  </div>;
}

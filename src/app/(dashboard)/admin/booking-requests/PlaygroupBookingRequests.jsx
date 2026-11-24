"use client";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, FilterPopover, FilterTrigger } from "@/components/ui";
import { fmtDate, fmtTime } from "@/lib/dates";
import { useStore } from "@/lib/store";

const pendingStatuses = ["pending", "awaiting_admin"];
const bookingStatusOf = (booking) => String(booking.status || booking.bookingStatus || "").toLowerCase();
const peso = (amount) => `₱${Number(amount || 0).toLocaleString()}`;

export default function PlaygroupBookingRequests() {
  const s = useStore();
  const [busy, setBusy] = useState({});
  const [errors, setErrors] = useState({});
  const [sortOrder, setSortOrder] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const nameOf = (id) => s.db.tutees.find((tutee) => tutee.userId === id)?.fullName || id;
  const requests = (s.db.bookings || []).filter((booking) => booking.program === "playgroup" && pendingStatuses.includes(bookingStatusOf(booking)))
    .sort((a, b) => {
      const comparison = String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      return sortOrder === "newest" ? -comparison : comparison;
    });
  const cohortOf = (booking) => s.db.cohorts.find((cohort) => cohort.id === booking.cohortId);
  const dateLabel = (date) => date ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "—";
  const approve = async (booking) => {
    setBusy((current) => ({ ...current, [booking.id]: true }));
    setErrors((current) => ({ ...current, [booking.id]: "" }));
    try {
      const response = await fetch("/api/state/approve-playgroup-booking", {
        method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
        body: JSON.stringify({ bookingId: booking.id }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "The Playgroup booking could not be approved.");
      window.location.reload();
    } catch (error) {
      setErrors((current) => ({ ...current, [booking.id]: error.message || "The Playgroup booking could not be approved." }));
      setBusy((current) => ({ ...current, [booking.id]: false }));
    }
  };
  const reject = async (booking) => {
    const result = await s.rejectBooking(booking.id, "The Playgroup booking request was not approved. Please choose another cohort.");
    if (result?.ok === false) setErrors((current) => ({ ...current, [booking.id]: result.error }));
  };

  if (!requests.length) return <Empty>No pending playgroup booking requests.</Empty>;
  return <>
  <div className="relative mb-3 flex justify-end"><FilterTrigger onClick={() => setFiltersOpen((open) => !open)} ariaLabel="Filter Playgroup booking requests" expanded={filtersOpen} count={sortOrder !== "newest" ? 1 : 0}/>{filtersOpen && <FilterPopover onClear={() => setSortOrder("newest")} onApply={() => setFiltersOpen(false)}><fieldset><legend className="mb-2 text-xs font-extrabold text-slate-700">Sort by</legend><div className="space-y-1">{[["newest", "Newest first"], ["oldest", "Oldest first"]].map(([value, label]) => <label key={value} className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-slate-700 hover:bg-brand-50"><input type="radio" name="playgroup-request-sort" checked={sortOrder === value} onChange={() => setSortOrder(value)} className="accent-brand-600"/>{label}</label>)}</div></fieldset></FilterPopover>}</div>
  <div className="space-y-3">
    {requests.map((booking) => {
      const cohort = cohortOf(booking);
      const dates = [...(booking.dates || [])].sort();
      const dateBooked = booking.createdAt ? String(booking.createdAt).slice(0, 10) : "";
      const allTutorsAssigned = dates.length > 0 && dates.every((date) => booking.tutorAssignments?.[date]);
      return <Card key={booking.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="space-y-1">
          <h2 className="font-bold text-slate-800">{nameOf(booking.tuteeId)} · {booking.gradeLevel || "Playgroup"}</h2>
          <p className="text-sm text-slate-500">{dates.length || 12} sessions · {peso(booking.totalFee || (booking.ratePerHour || 0) * dates.length)}</p>
          <p className="text-sm"><span className="font-medium">Playgroup Schedule:</span> {dateLabel(dates[0])} until {dateLabel(dates[dates.length - 1])} · {fmtTime(booking.time || cohort?.time || "10:00")}–11:30 AM</p>
          <p className="text-sm text-slate-500">{cohort?.label ? `${cohort.label} · ` : ""}Booked at {dateBooked ? dateLabel(dateBooked) : "—"}</p>
          {errors[booking.id] && <Alert kind="error">{errors[booking.id]}</Alert>}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <Badge status={bookingStatusOf(booking)}>Pending</Badge>
          <Button size="sm" variant="success" disabled={!allTutorsAssigned || busy[booking.id]} onClick={() => approve(booking)}>{busy[booking.id] ? "Approving…" : "Approve"}</Button>
          <Button size="sm" variant="danger" onClick={() => reject(booking)}>Reject</Button>
        </div>
        {!allTutorsAssigned && <p className="text-xs font-semibold text-red-500 sm:col-span-2">Assign tutors for all sessions in Playgroup Schedule to enable approval.</p>}
      </Card>;
    })}
  </div>
  </>;
}

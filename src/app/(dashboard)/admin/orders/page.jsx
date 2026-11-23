"use client";
import { useEffect, useMemo, useState } from "react";
import { Button, Empty, Input, Modal, PageHeader, Textarea, peso } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";

const proofRejected = (booking) => booking.paymentStatus === "proof_rejected";
const statusFor = (booking) => booking.status === "awaiting_payment_approval" || booking.paymentStatus === "awaiting_approval" ? "verification"
  : booking.paymentStatus === "paid" ? "paid"
    : booking.status === "expired" ? "overdue" : "unpaid";
const filterKey = (label) => ({ "For Verification": "verification" })[label] || label.toLowerCase();

export default function BookingPayments() {
  const s = useStore();
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const name = (id) => s.db.tutees.find((t) => t.userId === id)?.fullName || s.db.users.find((u) => u.id === id)?.username || id;

  useEffect(() => {
    if (!s.ready || !s.me) return;
    let active = true;
    void fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "processPaymentDeadlines", args: [] }) })
      .then((response) => response.json())
      .then((payload) => {
        if (!active || !payload.db) return;
        const changed = payload.db.bookings.some((booking) => {
          const previous = s.db.bookings.find((old) => old.id === booking.id)?.status;
          return (booking.status === "expired" && previous !== "expired") || (booking.status === "to_pay" && previous !== "to_pay");
        });
        if (changed) window.location.reload();
      }).catch(() => {});
    return () => { active = false; };
  }, [s.ready, s.me, s.db.bookings]);

  const records = useMemo(() => s.db.bookings
    .filter((booking) => ["to_pay", "awaiting_payment_approval", "confirmed", "approved", "expired"].includes(booking.status) || booking.paymentStatus)
    .sort((a, b) => String(b.paymentDeadlineAt || b.at || b.createdAt || "").localeCompare(String(a.paymentDeadlineAt || a.at || a.createdAt || ""))), [s.db.bookings]);
  const filters = ["All", "Unpaid", "For Verification", "Paid", "Overdue"];
  const counts = Object.fromEntries(filters.map((label) => [label, records.filter((record) => label === "All" || statusFor(record) === filterKey(label)).length]));
  const visible = records.filter((booking) => {
    const status = statusFor(booking);
    return (filter === "All" || status === filterKey(filter)) && `${name(booking.tuteeId)} ${booking.id} ${booking.subject || ""}`.toLowerCase().includes(query.toLowerCase());
  });
  const review = async (booking, approve, note = "") => {
    if (!approve && !note.trim()) return setMessage("Enter a reason before rejecting this receipt.");
    setMessage("");
    const response = await fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "reviewBookingPayment", args: [booking.id, approve, note.trim()] }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(payload.error || "Could not update this payment.");
    window.location.reload();
  };
  const deadlineOf = (booking) => booking.paymentDeadlineAt || booking.expiresAt;
  const paymentMethod = (booking) => booking.paymentProof?.method;

  return <>
    <PageHeader title="Booking Payment Records" subtitle="Review program booking receipts and payment status." />
    <div className="mb-5 flex justify-end"><Button onClick={() => setSelected({ settings: true })}>Payment Settings</Button></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      {[
        { label: "Paid Bookings", status: "paid", tone: "bg-mint-100 text-mint-600" },
        { label: "Unpaid Bookings", status: "unpaid", tone: "bg-sunny-100 text-amber-600" },
        { label: "Overdue Payments", status: "overdue", tone: "bg-coral-100 text-coral-700" },
      ].map((tile) => <button key={tile.status} onClick={() => setFilter(tile.status === filterKey(filter) ? "All" : tile.status[0].toUpperCase() + tile.status.slice(1))} className={`rounded-2xl p-5 text-left shadow-sm ${tile.tone}`}><div className="text-sm font-bold">{tile.label}</div><div className="mt-1 text-3xl font-extrabold">{records.filter((record) => statusFor(record) === tile.status).length}</div></button>)}
    </div>
    <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <h2 className="mb-4 text-xl font-extrabold">Payment Records</h2>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tutee name or booking ID…" className="mb-4 rounded-full border-2 border-slate-400 px-5 py-3" />
      <div className="mb-5 flex flex-wrap gap-2 rounded-full border-2 border-brand-500 p-1">
        {filters.map((label) => <button key={label} onClick={() => setFilter(label)} className={`flex-1 rounded-full px-3 py-2 text-sm font-bold ${filter === label ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}>{label}<span className="ml-1 hidden text-xs opacity-75 sm:inline">{counts[label]}</span></button>)}
      </div>
      {message && <p role="alert" className="mb-3 rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-700">{message}</p>}
      {visible.length === 0 ? <Empty>No booking payments match this filter.</Empty> : <div className="overflow-x-auto rounded-2xl bg-blue-50/70">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-brand-400 text-white"><tr>{["Tutee", "Payment Method", "Amount", "Status", ""].map((label) => <th key={label} className="px-4 py-4 font-extrabold">{label}</th>)}</tr></thead>
          <tbody>{visible.map((booking) => { const status = statusFor(booking); return <tr key={booking.id} className="border-b border-white last:border-0">
            <td className="px-4 py-4 font-bold">{name(booking.tuteeId)}<span className="block text-xs text-slate-500">{booking.id}</span></td>
            <td className="px-4 py-4 font-semibold">{paymentMethod(booking) ? paymentMethod(booking) === "in_person" ? "In-person" : "Online" : "—"}</td>
            <td className="px-4 py-4 font-extrabold">{peso(booking.paymentAmount ?? booking.totalFee ?? 0)}</td>
            <td className="px-4 py-4"><div className="flex flex-col items-start gap-1"><span className={`inline-flex min-w-28 justify-center rounded-lg px-3 py-2 font-bold ${status === "paid" ? "bg-mint-100 text-mint-600" : status === "unpaid" ? "bg-sunny-100 text-amber-600" : status === "verification" ? "bg-brand-100 text-brand-700" : "bg-coral-100 text-coral-600"}`}>{status === "verification" ? "To Verify" : status === "unpaid" && booking.status === "to_pay" ? "To Pay" : ({ unpaid: "Unpaid", paid: "Paid", overdue: "Overdue" })[status]}</span>{proofRejected(booking) && <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Receipt Rejected</span>}</div></td>
            <td className="px-4 py-4 text-right"><Button size="sm" variant="secondary" onClick={() => { setMessage(""); setRejectionReason(""); setSelected(booking); }}>View Details</Button></td>
          </tr>; })}</tbody>
        </table>
      </div>}
    </section>
    <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.settings ? "Payment Settings" : "Booking Payment Details"} wide>
      {selected?.settings ? <div className="space-y-3 text-sm text-slate-600"><p>Payment account instructions are managed by the center. Confirm current transfer details with the tutee before recording an offline payment.</p><p className="rounded-xl bg-slate-50 p-3">Online transfer proof must be reviewed from the booking payment record.</p></div> : selected && (() => {
        const booking = selected; const status = statusFor(booking); const deadline = deadlineOf(booking); const proof = booking.paymentProof;
        return <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-100 p-4"><h3 className="mb-3 border-b border-white pb-2 font-extrabold">Booking details</h3><dl className="space-y-2 text-sm text-slate-600"><div className="flex justify-between gap-3"><dt>ID</dt><dd className="font-semibold">{booking.id}</dd></div><div className="flex justify-between gap-3"><dt>Tutee</dt><dd className="font-semibold">{name(booking.tuteeId)}</dd></div><div className="flex justify-between gap-3"><dt>Program</dt><dd className="font-semibold">{booking.subject}</dd></div><div className="flex justify-between gap-3"><dt>Sessions</dt><dd className="font-semibold">{booking.sessionSlots?.length ?? booking.dates?.length ?? 0}</dd></div><div className="flex justify-between gap-3"><dt>Amount due</dt><dd className="font-extrabold">{peso(booking.paymentAmount ?? booking.totalFee ?? 0)}</dd></div></dl></div>
            <div className="rounded-2xl border-2 border-slate-300 p-4"><h3 className="mb-3 border-b-2 border-slate-200 pb-2 font-extrabold">Payment details</h3><dl className="space-y-2 text-sm text-slate-600"><div className="flex justify-between gap-3"><dt>Payment method</dt><dd>{paymentMethod(booking) ? paymentMethod(booking) === "in_person" ? "In-person" : "Online" : "Not submitted"}</dd></div><div className="flex justify-between gap-3"><dt>Submitted</dt><dd>{proof?.submittedAt ? fmtDateTime(proof.submittedAt) : "—"}</dd></div><div className="flex justify-between gap-3"><dt>Deadline</dt><dd>{deadline ? fmtDateTime(deadline) : "—"}</dd></div><div className="flex justify-between gap-3"><dt>Status</dt><dd className="font-bold capitalize">{booking.paymentStatus === "proof_rejected" ? "To Pay · Receipt Rejected" : status.replace("_", " ")}</dd></div></dl>{proofRejected(booking) && booking.paymentReviewNote && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"><b>Rejection reason:</b> {booking.paymentReviewNote}</p>}</div>
          </div>
          {proof?.receiptData?.startsWith("data:image/") && <div className="rounded-2xl border-2 border-slate-200 p-3"><h3 className="mb-2 font-extrabold">Submitted receipt</h3><img src={proof.receiptData} alt="Submitted payment receipt" className="mx-auto max-h-[60vh] max-w-full rounded-lg object-contain"/></div>}
          {proof?.receiptData?.startsWith("data:application/pdf") && <a href={proof.receiptData} target="_blank" rel="noreferrer" className="block rounded-2xl bg-brand-600 px-4 py-3 text-center font-bold text-white">Open PDF Receipt</a>}
          {status === "verification" && <div className="space-y-3"><label className="block"><span className="mb-1 block text-sm font-bold text-slate-700">Reason if rejecting <span className="text-red-600">(required to reject)</span></span><Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} placeholder="Explain what needs to be corrected in the receipt." /></label>{message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}<div className="flex gap-3"><Button className="flex-1" variant="success" onClick={() => review(booking, true)}>Approve Payment</Button><Button className="flex-1" variant="danger" disabled={!rejectionReason.trim()} onClick={() => review(booking, false, rejectionReason)}>Reject Proof</Button></div></div>}
          {proof?.reference && <p className="text-sm text-slate-500">Reference: {proof.reference}</p>}
        </div>;
      })()}
    </Modal>
  </>;
}

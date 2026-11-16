"use client";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, Input, Modal, PageHeader, Textarea, peso } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";

const filterKey = (label) => ({ "For Verification": "verification" })[label] || label.toLowerCase();
const proofRejectedFor = (record) => record.kind === "booking"
  ? record.data.paymentStatus === "proof_rejected"
  : record.data.status === "pending" && !!record.data.paymentReviewedAt && !!record.data.paymentReviewNote;
const statusFor = (record) => record.kind === "booking"
  ? record.data.status === "awaiting_payment_approval" || record.data.paymentStatus === "awaiting_approval" ? "verification"
    : record.data.paymentStatus === "paid" ? "paid"
      : record.data.status === "expired" ? "overdue"
        : record.data.status === "confirmed" && record.data.paymentStatus === "paid" ? "completed" : "unpaid"
  : ({ pending: "unpaid", awaiting_verification: "verification", paid: "paid", released: "completed", expired: "overdue" }[record.data.status] || record.data.status);

export default function Orders() {
  const s = useStore();
  const [kind, setKind] = useState("booking");
  const [filter, setFilter] = useState("All");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  useEffect(() => {
    if (!s.ready || !s.me) return;
    let active = true;
    void fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "processPaymentDeadlines", args: [] }) })
      .then((response) => response.json())
      .then((payload) => {
        if (!active || !payload.db) return;
        const changed = payload.db.purchases.some((order) => order.status === "expired" && s.db.purchases.find((old) => old.id === order.id)?.status !== "expired")
          || payload.db.bookings.some((booking) => {
            const previous = s.db.bookings.find((old) => old.id === booking.id)?.status;
            return (booking.status === "expired" && previous !== "expired") || (booking.status === "to_pay" && previous !== "to_pay");
          });
        if (changed) window.location.reload();
      }).catch(() => {});
    return () => { active = false; };
  }, [s.ready, s.me, s.db.bookings, s.db.purchases]);
  const name = (id) => s.db.tutees.find((t) => t.userId === id)?.fullName || s.db.users.find((u) => u.id === id)?.username || id;
  const records = useMemo(() => [
    ...s.db.bookings.filter((b) => ["to_pay", "awaiting_payment_approval", "confirmed", "approved", "expired"].includes(b.status) || b.paymentStatus).map((data) => ({ kind: "booking", data })),
    ...s.db.purchases.map((data) => ({ kind: "purchase", data })),
  ].filter((record) => record.kind === kind)
    .sort((a, b) => String(b.data.paymentDeadlineAt || b.data.at || b.data.createdAt || "").localeCompare(String(a.data.paymentDeadlineAt || a.data.at || a.data.createdAt || ""))), [s.db.bookings, s.db.purchases, kind]);
  const filters = ["All", "Unpaid", "For Verification", "Paid", ...(kind === "purchase" ? ["Completed"] : []), "Overdue"];
  const counts = Object.fromEntries(filters.map((label) => [label, records.filter((record) => label === "All" || statusFor(record) === filterKey(label)).length]));
  const visible = records.filter((record) => {
    const data = record.data;
    const status = statusFor(record);
    const statusMatch = filter === "All" || status === filterKey(filter);
    const searchText = `${name(data.tuteeId)} ${data.id} ${data.subject || ""} ${(data.items || []).map((item) => item.name).join(" ")}`.toLowerCase();
    return statusMatch && searchText.includes(query.toLowerCase());
  });
  const countsAll = (targetKind, targetStatus) => [
    ...s.db.bookings.filter((b) => ["to_pay", "awaiting_payment_approval", "confirmed", "approved", "expired"].includes(b.status) || b.paymentStatus).map((data) => ({ kind: "booking", data })),
    ...s.db.purchases.map((data) => ({ kind: "purchase", data })),
  ].filter((record) => record.kind === targetKind && (!targetStatus || statusFor(record) === targetStatus)).length;
  const review = async (record, approve, note = "") => {
    if (!approve && !note.trim()) return setMessage("Enter a reason before rejecting this receipt.");
    setMessage("");
    const action = record.kind === "booking" ? "reviewBookingPayment" : "reviewPurchasePayment";
    const response = await fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action, args: [record.data.id, approve, note.trim()] }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return setMessage(payload.error || "Could not update this payment.");
    window.location.reload();
  };
  const markPaid = async (record) => {
    const result = await s.updatePurchase(record.data.id, "paid");
    if (result?.ok === false) return setMessage(result.error || "Could not record this payment.");
    window.location.reload();
  };
  const pickedUp = async (record) => {
    const result = await s.updatePurchase(record.data.id, "released");
    if (result?.ok === false) return setMessage(result.error || "Could not record pickup.");
    window.location.reload();
  };
  const deadlineOf = (record) => record.kind === "booking" ? record.data.paymentDeadlineAt || record.data.expiresAt : new Date(Date.parse(record.data.at) + 48 * 60 * 60 * 1000).toISOString();
  const paymentMethod = (record) => record.kind === "booking" ? record.data.paymentProof?.method : record.data.paymentMethod;

  return <>
    <PageHeader title="Payment Records" subtitle="Review booking and purchase payments." />
    <div className="mb-5 flex justify-end"><Button onClick={() => setSelected({ kind: "settings", data: null })}>Payment Settings</Button></div>
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      {[
        { label: `Paid ${kind === "booking" ? "Bookings" : "Purchases"}`, status: "paid", tone: "bg-mint-100 text-mint-600" },
        { label: `Unpaid ${kind === "booking" ? "Bookings" : "Purchases"}`, status: "unpaid", tone: "bg-sunny-100 text-amber-600" },
        { label: "Overdue Payments", status: "overdue", tone: "bg-coral-100 text-coral-700" },
      ].map((tile) => <button key={tile.status} onClick={() => setFilter(tile.status === filter ? "All" : tile.status[0].toUpperCase() + tile.status.slice(1))} className={`rounded-2xl p-5 text-left shadow-sm ${tile.tone}`}><div className="text-sm font-bold">{tile.label}</div><div className="mt-1 text-3xl font-extrabold">{countsAll(kind, tile.status)}</div></button>)}
    </div>
    <section className="rounded-3xl bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-6 flex rounded-full border-2 border-slate-300 p-1">
        {[ ["booking", "Booking Payments"], ["purchase", "Purchase Payments"] ].map(([value, label]) => <button key={value} onClick={() => { setKind(value); setFilter("All"); setQuery(""); setSelected(null); }} className={`flex-1 rounded-full px-3 py-2 text-sm font-bold ${kind === value ? "bg-slate-500 text-white" : "text-slate-600"}`}>{label}</button>)}
      </div>
      <h2 className="mb-4 text-xl font-extrabold">Payment Records</h2>
      <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search Tutee Name or ${kind === "booking" ? "Booking" : "Purchase"} ID…`} className="mb-4 rounded-full border-2 border-slate-400 px-5 py-3" />
      <div className="mb-5 flex flex-wrap gap-2 rounded-full border-2 border-brand-500 p-1">
        {filters.map((label) => <button key={label} onClick={() => setFilter(label)} className={`flex-1 rounded-full px-3 py-2 text-sm font-bold ${filter === label ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}>{label}<span className="ml-1 hidden text-xs opacity-75 sm:inline">{counts[label]}</span></button>)}
      </div>
      {message && <p role="alert" className="mb-3 rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-700">{message}</p>}
      {visible.length === 0 ? <Empty>No payment records match this filter.</Empty> : <div className="overflow-x-auto rounded-2xl bg-blue-50/70">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="bg-brand-400 text-white"><tr>{["Tutee", "Payment Method", "Amount", "Status", ""].map((label) => <th key={label} className="px-4 py-4 font-extrabold">{label}</th>)}</tr></thead>
          <tbody>{visible.map((record) => { const data = record.data; const status = statusFor(record); return <tr key={`${record.kind}-${data.id}`} className="border-b border-white last:border-0">
            <td className="px-4 py-4 font-bold">{name(data.tuteeId)}<span className="block text-xs text-slate-500">{data.id}</span></td>
            <td className="px-4 py-4 font-semibold">{paymentMethod(record) ? paymentMethod(record) === "in_person" ? "In-person" : paymentMethod(record) === "online" ? "Online" : paymentMethod(record) : "—"}</td>
            <td className="px-4 py-4 font-extrabold">{peso(record.kind === "booking" ? data.paymentAmount ?? data.totalFee ?? 0 : data.total)}</td>
            <td className="px-4 py-4"><div className="flex flex-col items-start gap-1"><span className={`inline-flex min-w-28 justify-center rounded-lg px-3 py-2 font-bold ${status === "paid" || status === "completed" ? "bg-mint-100 text-mint-600" : status === "unpaid" ? "bg-sunny-100 text-amber-600" : status === "verification" ? "bg-brand-100 text-brand-700" : "bg-coral-100 text-coral-600"}`}>{record.kind === "booking" && status === "unpaid" && data.status === "to_pay" ? "To Pay" : ({ verification: "To Verify", unpaid: "Unpaid", paid: "Paid", completed: "Completed", overdue: "Overdue" })[status]}</span>{proofRejectedFor(record) && <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Receipt Rejected</span>}</div></td>
            <td className="px-4 py-4 text-right"><Button size="sm" variant="secondary" onClick={() => { setMessage(""); setRejectionReason(""); setSelected(record); }}>View Details</Button></td>
          </tr>; })}</tbody>
        </table>
      </div>}
    </section>
    <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.kind === "settings" ? "Payment Settings" : "Payment Details"} wide>
      {selected?.kind === "settings" ? <div className="space-y-3 text-sm text-slate-600"><p>Payment account instructions are managed by the center. Confirm current transfer details with the tutee before recording an offline payment.</p><p className="rounded-xl bg-slate-50 p-3">Online transfer proof must be reviewed from the payment record before marking an order paid.</p></div> : selected && (() => {
        const record = selected; const data = record.data; const status = statusFor(record); const deadline = deadlineOf(record);
        const proof = record.kind === "booking" ? data.paymentProof : data.paymentProof;
        return <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-100 p-4"><h3 className="mb-3 border-b border-white pb-2 font-extrabold">{record.kind === "booking" ? "Booking details" : "Purchase details"}</h3><dl className="space-y-2 text-sm text-slate-600"><div className="flex justify-between gap-3"><dt>ID</dt><dd className="font-semibold">{data.id}</dd></div><div className="flex justify-between gap-3"><dt>Tutee</dt><dd className="font-semibold">{name(data.tuteeId)}</dd></div>{record.kind === "booking" ? <><div className="flex justify-between gap-3"><dt>Program</dt><dd className="font-semibold">{data.subject}</dd></div><div className="flex justify-between gap-3"><dt>Sessions</dt><dd className="font-semibold">{data.sessionSlots?.length ?? data.dates?.length ?? 0}</dd></div></> : <div><dt>Items</dt><dd className="mt-1 text-right font-semibold">{data.items.filter((item) => !item.__paymentMeta).map((item) => `${item.qty}× ${item.name}`).join(", ")}</dd></div>}<div className="flex justify-between gap-3"><dt>Amount due</dt><dd className="font-extrabold">{peso(record.kind === "booking" ? data.paymentAmount ?? data.totalFee ?? 0 : data.total)}</dd></div></dl></div>
            <div className="rounded-2xl border-2 border-slate-300 p-4"><h3 className="mb-3 border-b-2 border-slate-200 pb-2 font-extrabold">Payment details</h3><dl className="space-y-2 text-sm text-slate-600"><div className="flex justify-between gap-3"><dt>Payment method</dt><dd>{paymentMethod(record) ? paymentMethod(record) === "in_person" ? "In-person" : "Online" : "Not submitted"}</dd></div><div className="flex justify-between gap-3"><dt>Submitted</dt><dd>{(record.kind === "booking" ? proof?.submittedAt : data.paymentSubmittedAt) ? fmtDateTime(record.kind === "booking" ? proof.submittedAt : data.paymentSubmittedAt) : "—"}</dd></div><div className="flex justify-between gap-3"><dt>Deadline</dt><dd>{deadline ? fmtDateTime(deadline) : "—"}</dd></div><div className="flex justify-between gap-3"><dt>Status</dt><dd className="font-bold capitalize">{record.kind === "booking" && data.paymentStatus === "proof_rejected" ? "To Pay · Receipt Rejected" : status.replace("_", " ")}</dd></div></dl>{proofRejectedFor(record) && data.paymentReviewNote && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"><b>Rejection reason:</b> {data.paymentReviewNote}</p>}</div>
          </div>
          {proof?.receiptData?.startsWith("data:image/") && <div className="rounded-2xl border-2 border-slate-200 p-3"><h3 className="mb-2 font-extrabold">Submitted receipt</h3><img src={proof.receiptData} alt="Submitted payment receipt" className="mx-auto max-h-[60vh] max-w-full rounded-lg object-contain"/></div>}
          {proof?.receiptData?.startsWith("data:application/pdf") && <a href={proof.receiptData} target="_blank" rel="noreferrer" className="block rounded-2xl bg-brand-600 px-4 py-3 text-center font-bold text-white">Open PDF Receipt</a>}
          {status === "verification" && <div className="space-y-3"><label className="block"><span className="mb-1 block text-sm font-bold text-slate-700">Reason if rejecting <span className="text-red-600">(required to reject)</span></span><Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} placeholder="Explain what needs to be corrected in the receipt." /></label>{message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}<div className="flex gap-3"><Button className="flex-1" variant="success" onClick={() => review(record, true)}>Approve Payment</Button><Button className="flex-1" variant="danger" disabled={!rejectionReason.trim()} onClick={() => review(record, false, rejectionReason)}>Reject Proof</Button></div></div>}
          {record.kind === "purchase" && status === "unpaid" && <Button className="w-full" onClick={() => markPaid(record)}>Record In-person Payment</Button>}
          {record.kind === "purchase" && status === "paid" && <Button className="w-full" variant="success" onClick={() => pickedUp(record)}>Record Pickup</Button>}
          {record.kind === "purchase" && status === "completed" && <p className="rounded-xl bg-mint-100 p-3 text-center font-bold text-mint-700">Picked up · {data.releasedAt ? fmtDateTime(data.releasedAt) : "Pickup recorded"}</p>}
          {proof?.reference && <p className="text-sm text-slate-500">Reference: {proof.reference}</p>}
        </div>;
      })()}
    </Modal>
  </>;
}

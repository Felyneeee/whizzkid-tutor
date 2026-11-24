"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { SlidersHorizontal } from "lucide-react";
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
  const [methodFilter, setMethodFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("name-asc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [settingEntry, setSettingEntry] = useState(null);
  const [settingForm, setSettingForm] = useState({});
  const [settingsMessage, setSettingsMessage] = useState("");
  const paymentSettings = s.db.paymentSettings || { onlineAccounts: [], onlineEnabled: true, inPersonEnabled: true, addresses: [], paymentDeadlineHours: 48 };
  const name = (id) => s.db.tutees.find((t) => t.userId === id)?.fullName || s.db.users.find((u) => u.id === id)?.username || id;
  const paymentMethod = (booking) => booking.paymentProof?.method;

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
    return (filter === "All" || status === filterKey(filter))
      && (methodFilter === "all" || paymentMethod(booking) === methodFilter)
      && `${name(booking.tuteeId)} ${booking.id} ${booking.subject || ""}`.toLowerCase().includes(query.toLowerCase());
  }).sort((a, b) => {
    const result = name(a.tuteeId).localeCompare(name(b.tuteeId), undefined, { sensitivity: "base" });
    return sortOrder === "name-asc" ? result : -result;
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
  const saveSetting = async (op, value = {}) => {
    setSettingsMessage("");
    const result = await s.managePaymentSettings({ op, ...value });
    if (result?.ok === false) { setSettingsMessage(result.error || "Could not update payment settings."); return false; }
    setSettingEntry(null);
    return true;
  };

  return <>
    <PageHeader title="Payment Records" subtitle="Review program booking receipts and payment status." />
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
      <div className="mb-4 flex items-center gap-3">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tutee name or booking ID…" className="rounded-2xl border-2 border-slate-300 px-5 py-3" />
        <div className="relative shrink-0">
          <button type="button" onClick={() => setFiltersOpen((open) => !open)} aria-label="Filter and sort payment records" aria-expanded={filtersOpen} className="rounded-xl p-2.5 text-brand-600 hover:bg-brand-50"><SlidersHorizontal className="h-5 w-5"/></button>
          {filtersOpen && <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <label className="block px-1 text-xs font-bold uppercase tracking-wide text-slate-500">Payment method<select value={methodFilter} onChange={(event) => setMethodFilter(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700"><option value="all">All methods</option><option value="online">Online transfer</option><option value="in_person">In-person</option></select></label>
            <label className="mt-3 block border-t border-slate-100 px-1 pt-3 text-xs font-bold uppercase tracking-wide text-slate-500">Sort by name<select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm normal-case tracking-normal text-slate-700"><option value="name-asc">Ascending (A–Z)</option><option value="name-desc">Descending (Z–A)</option></select></label>
            <button type="button" onClick={() => setFiltersOpen(false)} className="mt-3 w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-bold text-white">Done</button>
          </div>}
        </div>
      </div>
      <div className="mb-5 flex flex-wrap gap-2 rounded-full border-2 border-brand-500 p-1">
        {filters.map((label) => <button key={label} onClick={() => setFilter(label)} className={`flex-1 rounded-full px-3 py-2 text-sm font-bold ${filter === label ? "bg-brand-600 text-white" : "text-slate-700 hover:bg-slate-50"}`}>{label}<span className="ml-1 hidden text-xs opacity-75 sm:inline">{counts[label]}</span></button>)}
      </div>
      {message && <p role="alert" className="mb-3 rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-700">{message}</p>}
      {visible.length === 0 ? <Empty>No booking payments match this filter.</Empty> : <div className="overflow-x-auto rounded-2xl bg-blue-50/70">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-400 text-white"><tr>{["Name", "Payment Method", "Amount", "Date Confirmed", "Status", ""].map((label) => <th key={label} className="px-4 py-4 font-extrabold">{label}</th>)}</tr></thead>
          <tbody>{visible.map((booking) => { const status = statusFor(booking); return <tr key={booking.id} className="border-b border-slate-300 bg-slate-50 last:border-0">
            <td className="px-4 py-4 font-bold">{name(booking.tuteeId)}<span className="block text-xs text-slate-500">{booking.id}</span></td>
            <td className="px-4 py-4 font-semibold">{paymentMethod(booking) ? paymentMethod(booking) === "in_person" ? "In-person" : "Online" : "—"}</td>
            <td className="px-4 py-4 font-extrabold">{peso(booking.paymentAmount ?? booking.totalFee ?? 0)}</td>
            <td className="whitespace-nowrap px-4 py-4">{status === "paid" && (booking.paymentApprovedAt || booking.paymentProof?.submittedAt) ? fmtDateTime(booking.paymentApprovedAt || booking.paymentProof?.submittedAt) : "-----"}</td>
            <td className="px-4 py-4"><div className="flex flex-col items-start gap-1"><span className={`inline-flex min-w-24 justify-center rounded-full px-3 py-1.5 text-xs font-bold ${status === "paid" ? "bg-mint-100 text-mint-700" : status === "unpaid" ? "bg-sunny-100 text-amber-700" : status === "verification" ? "bg-blue-100 text-blue-700" : "bg-red-100 text-red-700"}`}>{status === "verification" ? "To Verify" : ({ unpaid: "Unpaid", paid: "Paid", overdue: "Overdue" })[status]}</span>{proofRejected(booking) && <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700">Receipt Rejected</span>}</div></td>
            <td className="px-4 py-4 text-right"><button onClick={() => { setMessage(""); setRejectionReason(""); setSelected(booking); }} className="whitespace-nowrap rounded-xl bg-brand-600 px-4 py-2 text-xs font-bold text-white hover:bg-brand-700">View Details</button></td>
          </tr>; })}</tbody>
        </table>
      </div>}
    </section>
    <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.settings ? "Payment Settings" : "Booking Payment Details"} wide>
      {selected?.settings ? <div className="space-y-5 text-sm text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-extrabold">Adjust Payment Deadline</h3><select value={paymentSettings.paymentDeadlineHours || 48} onChange={(event) => void saveSetting("deadline", { hours: Number(event.target.value) })} className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 font-bold">{[24, 48, 72, 96].map((hours) => <option key={hours} value={hours}>{hours} Hours</option>)}</select></div>
        {settingsMessage && <p role="alert" className="rounded-xl bg-red-50 p-3 font-semibold text-red-700">{settingsMessage}</p>}
        <section className="rounded-2xl bg-slate-50 p-4 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-extrabold">Online Transfer Accounts</h3><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-2 font-bold ${paymentSettings.onlineEnabled ? "bg-mint-100 text-mint-700" : "bg-red-100 text-red-700"}`}>{paymentSettings.onlineEnabled ? "Enabled" : "Disabled"}</span><button onClick={() => void saveSetting("toggle-online")} className="rounded-xl bg-red-500 px-4 py-2 font-bold text-white">{paymentSettings.onlineEnabled ? "Disable" : "Enable"}</button></div></div>
          <div className="grid gap-4 md:grid-cols-2">{paymentSettings.onlineAccounts.map((account) => <article key={account.id} className="rounded-2xl bg-white p-4 shadow-sm"><div className="flex items-start justify-between gap-3"><h4 className="text-lg font-extrabold">{account.provider}</h4><span className={`rounded-full px-3 py-1 text-xs font-bold ${account.active ? "bg-mint-100 text-mint-700" : "bg-red-100 text-red-700"}`}>{account.active ? "Active" : "Deactivated"}</span></div><p className="mt-3"><b>Account Name</b><span className="float-right">{account.accountName}</span></p><p><b>Account Number</b><span className="float-right">{account.accountNumber}</span></p><div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => void saveSetting("account-toggle", { id: account.id })} className="rounded-lg bg-red-500 px-3 py-2 font-bold text-white">{account.active ? "Deactivate" : "Activate"}</button><button onClick={() => { setSettingForm({ provider: account.provider, accountName: account.accountName, accountNumber: account.accountNumber }); setSettingEntry({ kind: "account", id: account.id }); }} className="rounded-lg bg-brand-600 px-3 py-2 font-bold text-white">Edit</button></div><button onClick={() => void saveSetting("account-delete", { id: account.id })} className="mt-2 w-full rounded-lg bg-slate-400 px-3 py-2 font-bold text-white">Delete</button></article>)}
            <button onClick={() => { setSettingForm({ provider: "", accountName: "", accountNumber: "" }); setSettingEntry({ kind: "account" }); }} className="min-h-44 rounded-2xl border-2 border-dashed border-slate-300 bg-white p-6 text-lg font-bold text-slate-600 hover:border-brand-400">＋ Add Account</button></div>
        </section>
        <section className="rounded-2xl bg-slate-50 p-4 sm:p-6"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h3 className="text-lg font-extrabold">In-Person Payment</h3><div className="flex items-center gap-3"><span className={`rounded-full px-3 py-2 font-bold ${paymentSettings.inPersonEnabled ? "bg-mint-100 text-mint-700" : "bg-red-100 text-red-700"}`}>{paymentSettings.inPersonEnabled ? "Enabled" : "Disabled"}</span><button onClick={() => void saveSetting("toggle-in-person")} className="rounded-xl bg-red-500 px-4 py-2 font-bold text-white">{paymentSettings.inPersonEnabled ? "Disable" : "Enable"}</button></div></div>
          <div className="space-y-3">{paymentSettings.addresses.map((address) => <article key={address.id} className="rounded-2xl bg-white p-4 shadow-sm"><h4 className="text-lg font-extrabold">{address.buildingName}</h4><p className="mt-2"><b>Address</b><span className="float-right max-w-[70%] text-right">{address.address}</span></p><p><b>Working Hours</b><span className="float-right">{address.workingHours}</span></p><div className="mt-4 flex gap-2"><button onClick={() => void saveSetting("address-delete", { id: address.id })} className="flex-1 rounded-lg bg-slate-400 px-3 py-2 font-bold text-white">Delete</button><button onClick={() => { setSettingForm({ buildingName: address.buildingName, address: address.address, workingHours: address.workingHours }); setSettingEntry({ kind: "address", id: address.id }); }} className="flex-1 rounded-lg bg-brand-600 px-3 py-2 font-bold text-white">Edit</button></div></article>)}
            <button onClick={() => { setSettingForm({ buildingName: "", address: "", workingHours: "" }); setSettingEntry({ kind: "address" }); }} className="w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 text-lg font-bold text-slate-600 hover:border-brand-400">＋ Add Address</button></div>
        </section>
        <Modal open={!!settingEntry} onClose={() => setSettingEntry(null)} title={`${settingEntry?.id ? "Edit" : "Add"} ${settingEntry?.kind === "account" ? "Account" : "Address"}`}>
          <form className="space-y-4" onSubmit={async (event) => { event.preventDefault(); await saveSetting(`${settingEntry.kind}-${settingEntry.id ? "update" : "add"}`, { id: settingEntry.id, entry: settingForm }); }}>
            {settingEntry?.kind === "account" ? <><label className="block font-bold">Payment Provider<select required className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2" value={settingForm.provider || ""} onChange={(event) => setSettingForm({ ...settingForm, provider: event.target.value })}><option value="" disabled>Select a provider</option>{["GCash", "Maya", "BDO Bank", "BPI", "Other"].map((provider) => <option key={provider} value={provider}>{provider}</option>)}</select></label><label className="block font-bold">Account Name<Input required className="mt-1" placeholder="Account holder name" value={settingForm.accountName || ""} onChange={(event) => setSettingForm({ ...settingForm, accountName: event.target.value })}/></label><label className="block font-bold">Account Number<Input required className="mt-1" placeholder="Account number" value={settingForm.accountNumber || ""} onChange={(event) => setSettingForm({ ...settingForm, accountNumber: event.target.value })}/></label></> : <><label className="block font-bold">Building Name<Input required className="mt-1" value={settingForm.buildingName || ""} onChange={(event) => setSettingForm({ ...settingForm, buildingName: event.target.value })}/></label><label className="block font-bold">Address<Textarea required className="mt-1" value={settingForm.address || ""} onChange={(event) => setSettingForm({ ...settingForm, address: event.target.value })}/></label><label className="block font-bold">Working Hours<Input required className="mt-1" value={settingForm.workingHours || ""} onChange={(event) => setSettingForm({ ...settingForm, workingHours: event.target.value })}/></label></>}
            <Button className="w-full" type="submit">Save {settingEntry?.kind === "account" ? "Account" : "Address"}</Button>
          </form>
        </Modal>
      </div> : selected && (() => {
        const booking = selected; const status = statusFor(booking); const deadline = deadlineOf(booking); const proof = booking.paymentProof;
        return <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-100 p-4"><h3 className="mb-3 border-b border-white pb-2 font-extrabold">Booking details</h3><dl className="space-y-2 text-sm text-slate-600"><div className="flex justify-between gap-3"><dt>ID</dt><dd className="font-semibold">{booking.id}</dd></div><div className="flex justify-between gap-3"><dt>Tutee</dt><dd className="font-semibold">{name(booking.tuteeId)}</dd></div><div className="flex justify-between gap-3"><dt>Program</dt><dd className="font-semibold">{booking.subject}</dd></div><div className="flex justify-between gap-3"><dt>Sessions</dt><dd className="font-semibold">{booking.sessionSlots?.length ?? booking.dates?.length ?? 0}</dd></div><div className="flex justify-between gap-3"><dt>Amount due</dt><dd className="font-extrabold">{peso(booking.paymentAmount ?? booking.totalFee ?? 0)}</dd></div></dl></div>
            <div className="rounded-2xl border-2 border-slate-300 p-4"><h3 className="mb-3 border-b-2 border-slate-200 pb-2 font-extrabold">Payment details</h3><dl className="space-y-2 text-sm text-slate-600"><div className="flex justify-between gap-3"><dt>Payment method</dt><dd>{paymentMethod(booking) ? paymentMethod(booking) === "in_person" ? "In-person" : "Online" : "Not submitted"}</dd></div><div className="flex justify-between gap-3"><dt>Submitted</dt><dd>{proof?.submittedAt ? fmtDateTime(proof.submittedAt) : "—"}</dd></div><div className="flex justify-between gap-3"><dt>Deadline</dt><dd>{deadline ? fmtDateTime(deadline) : "—"}</dd></div><div className="flex justify-between gap-3"><dt>Status</dt><dd className="font-bold capitalize">{booking.paymentStatus === "proof_rejected" ? "To Pay · Receipt Rejected" : status.replace("_", " ")}</dd></div></dl>{proofRejected(booking) && booking.paymentReviewNote && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800"><b>Rejection reason:</b> {booking.paymentReviewNote}</p>}</div>
          </div>
          {proof?.receiptData?.startsWith("data:image/") && <div className="rounded-2xl border-2 border-slate-200 p-3"><h3 className="mb-2 font-extrabold">Submitted receipt</h3><Image src={proof.receiptData} alt="Submitted payment receipt" width={1600} height={1200} unoptimized className="mx-auto max-h-[60vh] max-w-full rounded-lg object-contain"/></div>}
          {proof?.receiptData?.startsWith("data:application/pdf") && <a href={proof.receiptData} target="_blank" rel="noreferrer" className="block rounded-2xl bg-brand-600 px-4 py-3 text-center font-bold text-white">Open PDF Receipt</a>}
          {status === "verification" && <div className="space-y-3"><label className="block"><span className="mb-1 block text-sm font-bold text-slate-700">Reason if rejecting <span className="text-red-600">(required to reject)</span></span><Textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength={500} placeholder="Explain what needs to be corrected in the receipt." /></label>{message && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p>}<div className="flex gap-3"><Button className="flex-1" variant="success" onClick={() => review(booking, true)}>Approve Payment</Button><Button className="flex-1" variant="danger" disabled={!rejectionReason.trim()} onClick={() => review(booking, false, rejectionReason)}>Reject Proof</Button></div></div>}
          {proof?.reference && <p className="text-sm text-slate-500">Reference: {proof.reference}</p>}
        </div>;
      })()}
    </Modal>
  </>;
}

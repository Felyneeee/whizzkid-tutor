"use client";
import { Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Empty, PageHeader, peso } from "@/components/ui";
import { SHOP_ITEMS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function Purchases() {
    const s = useStore();
    const id = s.me.id;
    const [qty, setQty] = useState({});
    const [done, setDone] = useState(false);
    const [files, setFiles] = useState({});
    const [methods, setMethods] = useState({});
    const [error, setError] = useState({});
    const [busy, setBusy] = useState({});
    useEffect(() => {
      if (!s.ready || !s.me) return;
      let active = true;
      void fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "processPaymentDeadlines", args: [] }) })
        .then((response) => response.json())
        .then((payload) => {
          if (!active || !payload.db) return;
          const expired = payload.db.purchases.some((order) => order.tuteeId === id && order.status === "expired" && s.db.purchases.find((old) => old.id === order.id)?.status !== "expired");
          if (expired) window.location.reload();
        }).catch(() => {});
      return () => { active = false; };
    }, [s.ready, s.me, s.db.purchases, id]);
    const items = SHOP_ITEMS.filter((i) => (qty[i.sku] || 0) > 0).map((i) => ({ ...i, qty: qty[i.sku] }));
    const total = items.reduce((a, i) => a + i.qty * i.price, 0);
    const orders = s.db.purchases.filter((p) => p.tuteeId === id);
    const submitProof = async (order) => {
      const file = files[order.id];
      if (!file) return setError((current) => ({ ...current, [order.id]: "Upload a receipt before submitting." }));
      setBusy((current) => ({ ...current, [order.id]: true }));
      setError((current) => ({ ...current, [order.id]: "" }));
      try {
        const receiptData = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error("Could not read this file.")); reader.readAsDataURL(file); });
        const response = await fetch("/api/state/action", { method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin", body: JSON.stringify({ action: "submitPurchasePaymentProof", args: [order.id, receiptData, "", methods[order.id] || "online"] }) });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) return setError((current) => ({ ...current, [order.id]: payload.error || "Could not submit payment proof." }));
        window.location.reload();
      } catch (e) { setError((current) => ({ ...current, [order.id]: e.message || "Could not submit payment proof." })); }
      finally { setBusy((current) => ({ ...current, [order.id]: false })); }
    };
    return (<>
      <PageHeader title="Purchases" subtitle="Shirts, workbooks and other miscellaneous fees."/>
      {done && <div className="mb-4"><Alert kind="success">Order placed. Payment must be recorded within 48 hours or the order expires. Paid items can be picked up anytime; we’ll send weekly reminders until pickup.</Alert></div>}
      <div className="grid gap-3 md:grid-cols-2">
        {SHOP_ITEMS.map((i) => (<Card key={i.sku} className="flex items-center justify-between !p-4">
            <div>
              <div className="font-extrabold">{i.name}</div>
              <div className="text-sm text-slate-500">{i.price ? peso(i.price) : "FREE"}</div>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setQty({ ...qty, [i.sku]: Math.max(0, (qty[i.sku] || 0) - 1) })}>
                <Minus className="h-3 w-3"/>
              </Button>
              <span className="w-6 text-center font-bold">{qty[i.sku] || 0}</span>
              <Button size="sm" variant="secondary" onClick={() => setQty({ ...qty, [i.sku]: (qty[i.sku] || 0) + 1 })}>
                <Plus className="h-3 w-3"/>
              </Button>
            </div>
          </Card>))}
      </div>
      <Card className="mt-4 flex items-center justify-between">
        <div className="font-extrabold">Total: {peso(total)}</div>
        <Button disabled={!items.length} onClick={() => {
            s.placeOrder(id, items.map((i) => ({ sku: i.sku, name: i.name, qty: i.qty, price: i.price })));
            setQty({});
            setDone(true);
        }}>
          Place order
        </Button>
      </Card>

      <h2 className="mb-3 mt-8 text-lg font-extrabold">Order history</h2>
      {orders.length === 0 ? (<Empty>No orders yet.</Empty>) : (<div className="space-y-4">
          {orders.map((o) => { const deadline = new Date(Date.parse(o.at) + 48 * 60 * 60 * 1000); return <Card key={o.id} className="!p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-base font-extrabold">Purchase {o.id}</div><div className="text-sm font-semibold text-slate-500">{fmtDateTime(o.at)}</div></div><Badge status={o.status === "awaiting_verification" ? "awaiting_payment_approval" : o.status}/></div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-100 p-4"><h3 className="mb-2 border-b-2 border-white pb-2 font-extrabold">Purchase details</h3><div className="space-y-2 text-sm text-slate-600">{(o.items || []).filter((item) => !item.__paymentMeta).map((item) => <div key={`${o.id}-${item.sku}`} className="flex justify-between gap-3"><span>{item.qty}× {item.name}</span><span>{peso(item.qty * item.price)}</span></div>)}<div className="flex justify-between border-t border-white pt-2 font-extrabold"><span>Total amount</span><span>{peso(o.total)}</span></div></div></div>
                <div className="rounded-2xl border-2 border-slate-300 p-4 text-sm text-slate-600"><h3 className="mb-2 border-b-2 border-slate-200 pb-2 font-extrabold text-slate-800">Payment details</h3><div className="flex justify-between gap-2"><span>Payment method</span><span>{o.paymentMethod === "in_person" ? "In-person" : o.paymentMethod ? "Online" : "—"}</span></div><div className="mt-2 flex justify-between gap-2"><span>Payment deadline</span><span className={o.status === "pending" ? "font-bold text-red-500" : ""}>{fmtDateTime(deadline)}</span></div><div className="mt-2 flex justify-between gap-2"><span>Submitted</span><span>{o.paymentSubmittedAt ? fmtDateTime(o.paymentSubmittedAt) : "—"}</span></div></div>
              </div>
              {o.status === "pending" && <div className="mt-4 space-y-3"><h3 className="font-extrabold">Choose Payment Method</h3><div className="grid gap-2 sm:grid-cols-2">{[["online", "Online Transfer"], ["in_person", "In-person Payment"]].map(([value, label]) => <button key={value} type="button" onClick={() => setMethods((current) => ({ ...current, [o.id]: value }))} className={`rounded-xl bg-slate-100 p-3 text-left font-bold ${(methods[o.id] || "online") === value ? "ring-2 ring-brand-500" : ""}`}>{(methods[o.id] || "online") === value ? "◉" : "○"}　{label}</button>)}</div><p className="text-sm text-slate-500">{(methods[o.id] || "online") === "online" ? "Transfer the exact amount, then upload your receipt. Contact the center for current account details." : "Pay directly at the tutoring center, then upload your receipt."}</p><label className="block rounded-2xl border-2 border-dashed border-slate-300 p-5 text-center"><span className="block font-bold">{files[o.id]?.name || "Upload payment receipt (JPG, PNG, WEBP, or PDF; up to 5 MB)"}</span><input type="file" accept="image/png,image/jpeg,image/webp,application/pdf" className="mt-3 block w-full text-sm" onChange={(event) => setFiles((current) => ({ ...current, [o.id]: event.target.files?.[0] }))}/></label>{error[o.id] && <Alert kind="error">{error[o.id]}</Alert>}<Button className="w-full" disabled={!!busy[o.id]} onClick={() => submitProof(o)}>{busy[o.id] ? "Submitting…" : "Submit payment proof"}</Button></div>}
              {o.status === "awaiting_verification" && <p className="mt-4 rounded-xl bg-brand-50 p-3 text-sm font-semibold text-brand-700">Your payment proof is awaiting admin verification. Your order remains active while it is reviewed.</p>}
              {o.status === "paid" && <p className="mt-4 rounded-xl bg-mint-50 p-3 text-sm font-semibold text-mint-700">Payment approved. You can pick up your items anytime at the center.</p>}
              {o.status === "released" && <p className="mt-4 rounded-xl bg-mint-50 p-3 text-sm font-semibold text-mint-700">Picked up.</p>}
              {o.status === "expired" && <p className="mt-4 rounded-xl bg-coral-50 p-3 text-sm font-semibold text-coral-700">This order expired because payment proof was not submitted within 48 hours.</p>}
            </Card>; })}
        </div>)}
    </>);
}

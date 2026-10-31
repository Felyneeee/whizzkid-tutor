"use client";
import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Card, Empty, PageHeader, peso } from "@/components/ui";
import { SHOP_ITEMS } from "@/lib/constants";
import { fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function Purchases() {
    const s = useStore();
    const id = s.me.id;
    const [qty, setQty] = useState({});
    const [done, setDone] = useState(false);
    const items = SHOP_ITEMS.filter((i) => (qty[i.sku] || 0) > 0).map((i) => ({ ...i, qty: qty[i.sku] }));
    const total = items.reduce((a, i) => a + i.qty * i.price, 0);
    const orders = s.db.purchases.filter((p) => p.tuteeId === id);
    return (<>
      <PageHeader title="Purchases" subtitle="Shirts, workbooks and other miscellaneous fees."/>
      {done && <div className="mb-4"><Alert kind="success">Order placed! Please settle payment at the center.</Alert></div>}
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
      {orders.length === 0 ? (<Empty>No orders yet.</Empty>) : (<div className="space-y-2">
          {orders.map((o) => (<Card key={o.id} className="flex items-center justify-between !p-4">
              <div>
                <div className="text-sm font-bold">{o.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</div>
                <div className="text-xs text-slate-400">{fmtDateTime(o.at)} · {peso(o.total)}</div>
              </div>
              <Badge status={o.status}/>
            </Card>))}
        </div>)}
    </>);
}

"use client";
import { Badge, Button, Empty, PageHeader, Table, Td, peso } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function Orders() {
    const s = useStore();
    const list = [...s.db.purchases].sort((a, b) => b.at.localeCompare(a.at));
    const name = (id) => s.db.tutees.find((t) => t.userId === id)?.fullName || s.db.users.find((u) => u.id === id)?.username || id;
    return (<>
      <PageHeader title="Purchases" subtitle="Miscellaneous fees: shirts, workbooks and other items. Mark orders paid, then released."/>
      {list.length === 0 ? <Empty>No orders yet.</Empty> : (<Table head={["Date", "Tutee", "Items", "Total", "Status", ""]}>
          {list.map((p) => (<tr key={p.id}>
              <Td>{fmtDateTime(p.at)}</Td>
              <Td className="font-bold">{name(p.tuteeId)}</Td>
              <Td>{p.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</Td>
              <Td>{peso(p.total)}</Td>
              <Td><Badge status={p.status}/></Td>
              <Td>
                {p.status === "pending" && <Button size="sm" onClick={() => s.updatePurchase(p.id, "paid")}>Mark paid</Button>}
                {p.status === "paid" && <Button size="sm" variant="success" onClick={() => s.updatePurchase(p.id, "released")}>Release items</Button>}
              </Td>
            </tr>))}
        </Table>)}
    </>);
}

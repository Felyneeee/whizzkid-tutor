"use client";
import { Printer } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Empty, Field, Input, Modal, PageHeader, Stat, Table, Td, peso } from "@/components/ui";
import { fmtDateTime, monthKey, todayISO } from "@/lib/dates";
import { payrollFor } from "@/lib/logic";
import { useStore } from "@/lib/store";
export default function Payroll() {
    const s = useStore();
    const [period, setPeriod] = useState(monthKey(todayISO()));
    const [edit, setEdit] = useState(null);
    const tutors = s.db.tutors.filter((t) => t.status === "active");
    const records = s.db.payroll.filter((r) => r.period === period);
    const live = tutors.map((t) => ({ t, p: payrollFor(s.db, t.userId, period) }));
    const totalLive = live.reduce((a, x) => a + x.p.amount, 0);
    const totalPaid = records.filter((r) => r.paid).reduce((a, r) => a + r.amount, 0);
    const nm = (id) => s.db.tutors.find((t) => t.userId === id)?.fullName || id;
    return (<>
      <PageHeader title="Payroll" subtitle="Amount = completed & attended session hours × hourly rate + fixed salary. Verify sessions as completed under Scheduling first." action={<div className="flex items-center gap-2"><Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="!w-auto"/><Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4"/> Print</Button></div>}/>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Projected payroll" value={peso(totalLive)} tone="brand" sub={period}/>
        <Stat label="Generated records" value={records.length} tone="sunny"/>
        <Stat label="Released" value={peso(totalPaid)} tone="mint"/>
      </div>
      <h2 className="mb-2 font-extrabold">Tutor rates & live computation</h2>
      <Table head={["Tutor", "Hours", "Hourly rate", "Fixed salary", "Computed", ""]}>
        {live.map(({ t, p }) => (<tr key={t.userId}>
            <Td className="font-bold">{t.fullName}</Td><Td>{p.hours}</Td><Td>{peso(t.hourlyRate)}</Td><Td>{peso(t.fixedSalary)}</Td><Td className="font-bold">{peso(p.amount)}</Td>
            <Td><Button size="sm" variant="secondary" onClick={() => setEdit({ id: t.userId, hourlyRate: t.hourlyRate, fixedSalary: t.fixedSalary })}>Edit pay</Button></Td>
          </tr>))}
      </Table>
      <div className="mb-2 mt-8 flex items-center justify-between">
        <h2 className="font-extrabold">Payroll report — {period}</h2>
        <Button onClick={() => s.generatePayroll(period)}>Generate / refresh report</Button>
      </div>
      {records.length === 0 ? <Empty>No report generated for this period yet.</Empty> : (<Table head={["Tutor", "Hours", "Rate", "Fixed", "Amount", "Status", ""]}>
          {records.map((r) => (<tr key={r.id}>
              <Td className="font-bold">{nm(r.tutorId)}</Td><Td>{r.hours}</Td><Td>{peso(r.hourlyRate)}</Td><Td>{peso(r.fixedSalary)}</Td><Td className="font-bold">{peso(r.amount)}</Td>
              <Td><Badge status={r.paid ? "paid" : "pending"}/>{r.paidAt && <div className="text-xs text-slate-400">{fmtDateTime(r.paidAt)}</div>}</Td>
              <Td>{!r.paid && <Button size="sm" variant="success" onClick={() => s.markPayrollPaid(r.id)}>Record payment</Button>}</Td>
            </tr>))}
        </Table>)}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={`Pay settings — ${edit ? nm(edit.id) : ""}`}>
        {edit && (<form className="space-y-4" onSubmit={(e) => { e.preventDefault(); s.setTutorPay(edit.id, edit.hourlyRate, edit.fixedSalary); setEdit(null); }}>
            <Field label="Rate per hour (₱)"><Input type="number" min={0} required value={edit.hourlyRate} onChange={(e) => setEdit({ ...edit, hourlyRate: Number(e.target.value) })}/></Field>
            <Field label="Fixed monthly salary (₱)"><Input type="number" min={0} required value={edit.fixedSalary} onChange={(e) => setEdit({ ...edit, fixedSalary: Number(e.target.value) })}/></Field>
            <Button type="submit">Save</Button>
          </form>)}
      </Modal>
    </>);
}

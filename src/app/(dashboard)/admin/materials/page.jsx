"use client";
import { Eye, EyeOff, Trash2, Upload } from "lucide-react";
import { useState } from "react";
import { Alert, Badge, Button, Chips, Empty, Field, Input, Modal, PageHeader, Select, Table, Td, Textarea } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function AdminMaterials() {
    const s = useStore();
    const [open, setOpen] = useState(false);
    const [logFor, setLogFor] = useState(null);
    const [file, setFile] = useState(null);
    const [err, setErr] = useState("");
    const [f, setF] = useState({ title: "", program: "all", note: "", audience: ["Tutors", "Tutees"], allowedUserIds: [] });
    const people = [...s.db.tutors.filter((t) => t.status === "active").map((t) => ({ id: t.userId, name: `${t.fullName} (tutor)` })), ...s.db.tutees.map((t) => ({ id: t.userId, name: `${t.fullName || "Tutee"} (tutee)` }))];
    const save = async (e) => {
        e.preventDefault();
        setErr("");
        let data = "";
        if (file) {
            if (file.size > 1500000)
                return setErr("Demo storage is limited to 1.5 MB per file.");
            data = await new Promise((res) => {
                const r = new FileReader();
                r.onload = () => res(String(r.result));
                r.readAsDataURL(file);
            });
        }
        s.addMaterial({
            title: f.title,
            program: f.program,
            fileName: file?.name || "(no file)",
            mime: file?.type || "text/plain",
            size: file?.size || 0,
            data,
            note: f.note,
            allowTutors: f.audience.includes("Tutors"),
            allowTutees: f.audience.includes("Tutees"),
            allowedUserIds: f.allowedUserIds,
        });
        setOpen(false);
        setFile(null);
        setF({ title: "", program: "all", note: "", audience: ["Tutors", "Tutees"], allowedUserIds: [] });
    };
    const name = (id) => s.db.tutors.find((t) => t.userId === id)?.fullName || s.db.tutees.find((t) => t.userId === id)?.fullName || s.db.users.find((u) => u.id === id)?.username || id;
    return (<>
      <PageHeader title="Learning materials" subtitle="Upload protected, view-only resources. Control who can open them and review the access log." action={<Button onClick={() => setOpen(true)}><Upload className="h-4 w-4"/> Upload material</Button>}/>
      <div className="mb-4"><Alert kind="info">Anti-leak controls: view-only viewer (no download/print/copy), per-account watermark, blur on focus loss, per-user access lists, instant revoke, and an access log.</Alert></div>
      {s.db.materials.length === 0 ? <Empty>No materials uploaded.</Empty> : (<Table head={["Title", "Program", "Audience", "Restricted to", "Uploaded", "Views", "Status", ""]}>
          {s.db.materials.map((m) => (<tr key={m.id}>
              <Td><div className="font-bold">{m.title}</div><div className="text-xs text-slate-400">{m.fileName}</div></Td>
              <Td className="capitalize">{m.program}</Td>
              <Td>{[m.allowTutors && "Tutors", m.allowTutees && "Tutees"].filter(Boolean).join(", ") || "—"}</Td>
              <Td>{m.allowedUserIds.length ? `${m.allowedUserIds.length} user(s)` : "Everyone in audience"}</Td>
              <Td>{fmtDateTime(m.uploadedAt)}</Td>
              <Td><button className="font-bold text-brand-600 underline" onClick={() => setLogFor(m)}>{s.db.materialLogs.filter((l) => l.materialId === m.id).length}</button></Td>
              <Td><Badge status={m.revoked ? "rejected" : "approved"}>{m.revoked ? "revoked" : "active"}</Badge></Td>
              <Td>
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => s.updateMaterial(m.id, { revoked: !m.revoked })}>{m.revoked ? <Eye className="h-3.5 w-3.5"/> : <EyeOff className="h-3.5 w-3.5"/>}{m.revoked ? "Restore" : "Revoke"}</Button>
                  <Button size="sm" variant="ghost" aria-label="Delete" onClick={() => confirm(`Delete "${m.title}"?`) && s.deleteMaterial(m.id)}><Trash2 className="h-3.5 w-3.5"/></Button>
                </div>
              </Td>
            </tr>))}
        </Table>)}
      <Modal open={open} onClose={() => setOpen(false)} title="Upload material">
        <form className="space-y-4" onSubmit={save}>
          <Field label="Title"><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })}/></Field>
          <Field label="File" hint="PDF, image or text. Stored in browser storage for this demo."><Input type="file" accept=".pdf,image/*,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)}/></Field>
          <Field label="Program">
            <Select value={f.program} onChange={(e) => setF({ ...f, program: e.target.value })}>
              <option value="all">All programs</option><option value="reading">Reading</option><option value="academic">Academic</option><option value="playgroup">Playgroup</option>
            </Select>
          </Field>
          <Field label="Audience"><Chips multi options={["Tutors", "Tutees"]} value={f.audience} onChange={(v) => setF({ ...f, audience: v })}/></Field>
          <Field label="Restrict to specific users (optional)" hint="Leave empty to allow everyone in the audience.">
            <select multiple className="h-28 w-full rounded-xl border border-slate-200 p-2 text-sm" value={f.allowedUserIds} onChange={(e) => setF({ ...f, allowedUserIds: Array.from(e.target.selectedOptions).map((o) => o.value) })}>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field label="Note"><Textarea value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })}/></Field>
          {err && <Alert kind="error">{err}</Alert>}
          <Button type="submit">Upload</Button>
        </form>
      </Modal>
      <Modal open={!!logFor} onClose={() => setLogFor(null)} title={`Access log — ${logFor?.title ?? ""}`}>
        {logFor && (s.db.materialLogs.filter((l) => l.materialId === logFor.id).length === 0 ? <Empty>Not viewed yet.</Empty> : (<ul className="divide-y divide-slate-100 text-sm">
            {s.db.materialLogs.filter((l) => l.materialId === logFor.id).slice().reverse().map((l) => <li key={l.id} className="flex justify-between py-2"><span>{name(l.userId)}</span><span className="text-slate-400">{fmtDateTime(l.at)}</span></li>)}
          </ul>))}
      </Modal>
    </>);
}

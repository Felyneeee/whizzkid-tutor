"use client";
import { Eye, Pencil, Search, SlidersHorizontal, Trash2, Upload, CloudUpload, ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import { SUBJECTS } from "@/lib/constants";
import { Alert, Button, Empty, Field, Input, Modal, PageHeader, Select, Textarea } from "@/components/ui";
import { fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";

const emptyForm = () => ({ title: "", program: "all", subject: "", note: "" });
export default function AdminMaterials() {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState("newest");
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [f, setF] = useState(emptyForm);
  const fileRef = useRef(null);
  const materials = s.db.materials.filter((m) => (!selectedPrograms.length || selectedPrograms.includes(m.program)) && (!selectedSubjects.length || selectedSubjects.includes(m.subject || (m.program === "reading" ? "Reading" : ""))) && `${m.title} ${m.fileName} ${m.subject || ""} ${m.program}`.toLowerCase().includes(search.toLowerCase())).slice().sort((a, b) => (sortOrder === "oldest" ? 1 : -1) * (new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0)));
  const toggleFilter = (values, setValues, value) => setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const save = async (e) => {
    e.preventDefault(); setErr("");
    if (!file && !editing) return setErr("Choose a file to upload.");
    if (f.program === "academic" && !f.subject) return setErr("Choose the Academic subject for this material.");
    if (file?.size > 1500000) return setErr("Demo storage is limited to 1.5 MB per file.");
    const data = file ? await new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); }) : editing.data;
    const values = { title: f.title, program: f.program, subject: f.program === "academic" ? f.subject : "", fileName: file?.name || editing.fileName, mime: file?.type || editing.mime, size: file?.size ?? editing.size, data, note: f.note, allowTutors: true, allowTutees: false, allowedUserIds: [] };
    const result = editing ? await s.updateMaterial(editing.id, values) : await s.addMaterial(values);
    if (result?.ok === false) return setErr(result.error || "Could not save the material. Please try again.");
    setOpen(false); setEditing(null); setFile(null); setF(emptyForm());
  };
  const closeUpload = () => { setOpen(false); setEditing(null); setFile(null); setF(emptyForm()); setErr(""); };
  const editMaterial = (material) => { setEditing(material); setF({ title: material.title, program: material.program, subject: material.subject || "", note: material.note || "" }); setFile(null); setErr(""); setOpen(true); };
  return <>
    <PageHeader title="Learning materials" action={<Button onClick={() => setOpen(true)}><Upload className="h-4 w-4"/> Upload material</Button>}/>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <label className="relative block w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject, title, etc." className="pl-10" aria-label="Search materials"/></label>
      <div className="relative"><Button variant="secondary" onClick={() => setFiltersOpen(!filtersOpen)} aria-expanded={filtersOpen} aria-label="Filters"><SlidersHorizontal className="h-4 w-4 text-brand-600"/> Filters <ChevronDown className="h-4 w-4"/></Button>{filtersOpen && <div className="absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-100 bg-white p-4 shadow-xl"><div className="space-y-4"><div><label className="mb-2 block text-sm font-bold text-slate-800">Sort:</label><Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option></Select></div><fieldset><legend className="mb-2 text-sm font-bold text-slate-800">Subject</legend><div className="grid grid-cols-2 gap-x-3 gap-y-2">{[...SUBJECTS, "Reading"].map((subject) => <label key={subject} className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5 accent-brand-600" checked={selectedSubjects.includes(subject)} onChange={() => toggleFilter(selectedSubjects, setSelectedSubjects, subject)}/><span>{subject}</span></label>)}</div></fieldset><fieldset><legend className="mb-2 text-sm font-bold text-slate-800">Program</legend><div className="grid grid-cols-2 gap-x-3 gap-y-2">{[{id:"academic",label:"Academic"},{id:"reading",label:"Reading"},{id:"playgroup",label:"Playgroup"},{id:"all",label:"All programs"}].map((program) => <label key={program.id} className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5 accent-brand-600" checked={program.id === "all" ? selectedPrograms.length === 0 : selectedPrograms.includes(program.id)} onChange={() => program.id === "all" ? setSelectedPrograms([]) : toggleFilter(selectedPrograms.filter((value) => value !== "all"), setSelectedPrograms, program.id)}/><span>{program.label}</span></label>)}</div></fieldset></div></div>}</div>
    </div>
    {materials.length === 0 ? <Empty>{s.db.materials.length ? "No materials match your search." : "No materials uploaded."}</Empty> : <div className="space-y-3">{materials.map((m) => <div key={m.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"><div className="min-w-0"><h2 className="text-lg font-extrabold text-slate-900">{m.title}</h2><p className="mt-1 text-sm text-slate-500">{m.fileName} · {fmtDateTime(m.uploadedAt)}</p><p className="mt-1 text-sm text-slate-500">{({academic:"Academic",reading:"Reading",playgroup:"Playgroup",all:"All programs"})[m.program] || m.program}{m.subject ? ` · ${m.subject}` : ""}</p>{m.note && <p className="mt-2 text-sm text-slate-600">Note: {m.note}</p>}<p className="mt-2 text-xs text-slate-400">Available to tutors</p></div><div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="secondary" onClick={() => setPreview(m)}><Eye className="h-4 w-4"/> View</Button><Button size="sm" variant="secondary" onClick={() => editMaterial(m)}><Pencil className="h-4 w-4"/> Edit</Button><Button size="sm" variant="ghost" aria-label="Delete material" onClick={() => confirm(`Delete "${m.title}"?`) && s.deleteMaterial(m.id)}><Trash2 className="h-4 w-4"/></Button></div></div>)}</div>}
    <Modal open={open} onClose={closeUpload} title={editing ? "Edit material" : "Upload material"} wide>
      <form className="space-y-5" onSubmit={save}>
        <Field label={<>File {!editing && <span className="text-red-500">*</span>}</>}><button type="button" onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const chosen = e.dataTransfer.files?.[0]; if (chosen) setFile(chosen); }} className="flex min-h-44 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/50 px-5 py-7 text-center transition hover:border-brand-400 hover:bg-brand-50/40"><CloudUpload className="mb-3 h-10 w-10 text-brand-600"/>{file ? <><span className="font-bold text-slate-800">{file.name}</span><span className="mt-1 text-sm text-slate-500">Click or drop to replace</span></> : <><span className="text-lg font-bold"><span className="text-brand-600">Click to browse</span> or drag &amp; drop file here</span><span className="mt-2 text-sm text-slate-500">{editing ? `Current file: ${editing.fileName} · Choose a new file to replace it` : "PDF, JPG, PNG, or text · Up to 1.5 MB"}</span></>}</button><input ref={fileRef} type="file" accept=".pdf,image/*,.txt" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)}/></Field>
        <Field label={<>Material title <span className="text-red-500">*</span></>}><Input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Introduction to General Biology"/></Field>
        <Field label="Program"><Select value={f.program} onChange={(e) => setF({ ...f, program: e.target.value, subject: "" })}><option value="all">All programs</option><option value="reading">Reading</option><option value="academic">Academic</option><option value="playgroup">Playgroup</option></Select></Field>
        {f.program === "academic" && <Field label={<>Subject <span className="text-red-500">*</span></>}><Select required value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })}><option value="">Select subject</option>{SUBJECTS.map((subject) => <option key={subject} value={subject}>{subject === "Mathematics" ? "Math" : subject}</option>)}</Select></Field>}
        <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">Learning materials are available to tutors only.</p>
        <Field label={<>Note <span className="font-normal text-slate-400">(optional)</span></>}><Textarea maxLength={200} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })}/><span className="mt-1 block text-right text-xs text-slate-400">{f.note.length}/200</span></Field>
        {err && <Alert kind="error">{err}</Alert>}
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={closeUpload}>Cancel</Button><Button type="submit"><CloudUpload className="h-4 w-4"/> {editing ? "Save changes" : "Upload material"}</Button></div>
      </form>
    </Modal>
    <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title || "Material preview"} wide>{preview?.data ? preview.mime?.startsWith("image/") ? <img src={preview.data} alt={preview.title} className="mx-auto max-h-[75vh] max-w-full object-contain"/> : <iframe title={preview.title} src={preview.data} className="h-[75vh] w-full rounded-xl border border-slate-200 bg-white"/> : <Empty>No preview file is stored for this material.</Empty>}</Modal>
  </>;
}

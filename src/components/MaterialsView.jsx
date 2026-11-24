"use client";
import Image from "next/image";
import { Eye, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fmtDateTime } from "@/lib/dates";
import { SUBJECTS } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { Button, Empty, FilterPopover, FilterTrigger, Input, Modal, PageHeader, Select } from "./ui";
/** Materials the given user may open: not revoked, role allowed, and (if restricted) explicitly allowed. */
export function visibleMaterials(materials, role, userId, programs) {
    if (role === "tutee")
        return [];
    return materials.filter((m) => {
        if (m.revoked)
            return false;
        if (role === "tutor" ? !m.allowTutors : !m.allowTutees)
            return false;
        if (m.allowedUserIds.length && !m.allowedUserIds.includes(userId))
            return false;
        if (role === "tutee" && m.program !== "all" && !programs.includes(m.program))
            return false;
        return true;
    });
}
function SecureViewer({ m, viewer, onClose }) {
    const [blob, setBlob] = useState("");
    const [text, setText] = useState("");
    const [blurred, setBlurred] = useState(false);
    const stamp = useMemo(() => `${viewer} · ${new Date().toLocaleString()}`, [viewer]);
    useEffect(() => {
        let url = "";
        (async () => {
            if (!m.data)
                return;
            try {
                const res = await fetch(m.data);
                const b = await res.blob();
                if (m.mime.startsWith("text/"))
                    setText(await b.text());
                else {
                    url = URL.createObjectURL(b);
                    setBlob(url);
                }
            }
            catch {
                /* ignore */
            }
        })();
        return () => {
            if (url)
                URL.revokeObjectURL(url);
        };
    }, [m]);
    // anti-leak deterrents: blur on focus loss, block copy/print/save shortcuts
    useEffect(() => {
        const blur = () => setBlurred(true);
        const focus = () => setBlurred(false);
        const key = (e) => {
            if ((e.ctrlKey || e.metaKey) && ["s", "p", "c", "u"].includes(e.key.toLowerCase()))
                e.preventDefault();
            if (e.key === "PrintScreen")
                setBlurred(true);
        };
        window.addEventListener("blur", blur);
        window.addEventListener("focus", focus);
        window.addEventListener("keydown", key);
        return () => {
            window.removeEventListener("blur", blur);
            window.removeEventListener("focus", focus);
            window.removeEventListener("keydown", key);
        };
    }, []);
    const wm = Array.from({ length: 24 }, (_, i) => i);
    return (<Modal open onClose={onClose} title={m.title} wide>
      <div className="secure-viewer relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50" onContextMenu={(e) => e.preventDefault()} onCopy={(e) => e.preventDefault()} onDragStart={(e) => e.preventDefault()}>
        <div className={blurred ? "pointer-events-none blur-xl" : ""}>
          {m.mime.startsWith("image/") && blob && <Image src={blob} alt={m.title} width={1200} height={900} unoptimized draggable={false} className="mx-auto h-auto max-h-[60vh] w-auto max-w-full select-none"/>}
          {m.mime === "application/pdf" && blob && <>
            <div className="grid min-h-[45vh] place-items-center p-6 text-center md:hidden">
              <div className="max-w-sm">
                <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-xl bg-brand-50 text-lg font-extrabold text-brand-700">PDF</div>
                <p className="break-words text-sm font-semibold text-slate-700">{m.fileName || "Learning material.pdf"}</p>
                <p className="mt-2 text-xs text-slate-500">Open this PDF in your browser to view it on this device.</p>
                <a href={blob} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-brand-700">Open PDF</a>
              </div>
            </div>
            <iframe title={m.title} src={`${blob}#toolbar=0&navpanes=0&scrollbar=1`} className="hidden h-[60vh] w-full md:block"/>
          </>}
          {m.mime.startsWith("text/") && <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap p-4 text-sm">{text}</pre>}
          {!m.data && <div className="p-8 text-center text-sm text-slate-500">{m.note || "No preview content stored for this demo file."}</div>}
          {m.data && !m.mime.startsWith("image/") && m.mime !== "application/pdf" && !m.mime.startsWith("text/") && (<div className="p-8 text-center text-sm text-slate-500">Preview isn&apos;t available for this file type. Contact the admin for access.</div>)}
        </div>
        {/* tiled watermark overlay */}
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 content-around gap-6 overflow-hidden p-4 opacity-25">
          {wm.map((i) => (<span key={i} className="-rotate-[20deg] whitespace-nowrap text-center text-xs font-bold text-slate-600">
              {stamp}
            </span>))}
        </div>
        {blurred && <div className="absolute inset-0 grid place-items-center text-sm font-bold text-slate-700">Content hidden while window is unfocused</div>}
      </div>
    </Modal>);
}
export function MaterialsView({ role, userId }) {
    const s = useStore();
    const [open, setOpen] = useState(null);
    const [search, setSearch] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [sortOrder, setSortOrder] = useState("newest");
    const [selectedSubjects, setSelectedSubjects] = useState([]);
    const [selectedPrograms, setSelectedPrograms] = useState([]);
    const programs = s.db.bookings.filter((b) => b.tuteeId === userId && b.status !== "rejected").map((b) => b.program);
    const toggleFilter = (values, setValues, value) => setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
    const list = visibleMaterials(s.db.materials, role, userId, programs).filter((m) => (!selectedPrograms.length || selectedPrograms.includes(m.program)) && (!selectedSubjects.length || selectedSubjects.includes(m.subject || (m.program === "reading" ? "Reading" : ""))) && `${m.title} ${m.fileName} ${m.subject || ""} ${m.program}`.toLowerCase().includes(search.toLowerCase())).slice().sort((a, b) => (sortOrder === "oldest" ? 1 : -1) * (new Date(a.uploadedAt || 0) - new Date(b.uploadedAt || 0)));
    const email = s.me?.email || "user";
    return (<>
      <PageHeader title="Learning materials"/>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><label className="relative block w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search subject, title, etc." className="pl-10" aria-label="Search materials"/></label><div className="relative"><FilterTrigger onClick={() => setFiltersOpen(!filtersOpen)} ariaLabel="Filter materials" expanded={filtersOpen} count={selectedPrograms.length + selectedSubjects.length + (sortOrder !== "newest" ? 1 : 0)}/>{filtersOpen && <FilterPopover mobileAlign="left" onClear={() => { setSortOrder("newest"); setSelectedSubjects([]); setSelectedPrograms([]); }} onApply={() => setFiltersOpen(false)}><div className="space-y-3"><div><label className="mb-2 block text-xs font-extrabold text-slate-700">Sort by</label><Select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option></Select></div><fieldset><legend className="mb-2 text-xs font-extrabold text-slate-700">Subject</legend><div className="grid grid-cols-2 gap-x-3 gap-y-2">{[...SUBJECTS, "Reading"].map((subject) => <label key={subject} className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5 accent-brand-600" checked={selectedSubjects.includes(subject)} onChange={() => toggleFilter(selectedSubjects, setSelectedSubjects, subject)}/><span>{subject}</span></label>)}</div></fieldset><fieldset><legend className="mb-2 text-sm font-bold text-slate-800">Program</legend><div className="grid grid-cols-2 gap-x-3 gap-y-2">{[{id:"academic",label:"Academic"},{id:"reading",label:"Reading"},{id:"playgroup",label:"Playgroup"},{id:"all",label:"All programs"}].map((program) => <label key={program.id} className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" className="mt-0.5 accent-brand-600" checked={program.id === "all" ? selectedPrograms.length === 0 : selectedPrograms.includes(program.id)} onChange={() => program.id === "all" ? setSelectedPrograms([]) : toggleFilter(selectedPrograms.filter((value) => value !== "all"), setSelectedPrograms, program.id)}/><span>{program.label}</span></label>)}</div></fieldset></div></FilterPopover>}</div></div>
      {list.length === 0 ? (<Empty>No materials available to you yet.</Empty>) : (<div className="space-y-3">
          {list.map((m) => (<div key={m.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="min-w-0"><div className="text-lg font-extrabold text-slate-900">{m.title}</div>
                <div className="mt-1 text-sm text-slate-500">{m.fileName} · {fmtDateTime(m.uploadedAt)}</div>
                <div className="mt-1 text-sm text-slate-500">{m.program}{m.subject ? ` · ${m.subject}` : ""}</div>
                {m.note && <p className="mt-2 text-sm text-slate-600">Note: {m.note}</p>}
              </div>
              <Button size="sm" onClick={() => {
                    s.logMaterialAccess(m.id, userId);
                    setOpen(m);
                }}>
                <Eye className="h-4 w-4"/> View
              </Button>
            </div>))}
        </div>)}
      {open && <SecureViewer m={open} viewer={email} onClose={() => setOpen(null)}/>}
    </>);
}

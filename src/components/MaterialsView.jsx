"use client";
import Image from "next/image";
import { Eye, Lock, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { fmtDateTime } from "@/lib/dates";
import { useStore } from "@/lib/store";
import { Alert, Badge, Button, Card, Empty, Modal, PageHeader } from "./ui";
/** Materials the given user may open: not revoked, role allowed, and (if restricted) explicitly allowed. */
export function visibleMaterials(materials, role, userId, programs) {
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
          {m.mime === "application/pdf" && blob && <iframe title={m.title} src={`${blob}#toolbar=0&navpanes=0&scrollbar=1`} className="h-[60vh] w-full"/>}
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
      <p className="mt-3 flex items-center gap-1 text-xs text-slate-500">
        <ShieldAlert className="h-4 w-4"/> View-only. Downloading, copying and printing are disabled; every view is logged and watermarked with your account.
      </p>
    </Modal>);
}
export function MaterialsView({ role, userId }) {
    const s = useStore();
    const [open, setOpen] = useState(null);
    const programs = s.db.bookings.filter((b) => b.tuteeId === userId && b.status !== "rejected").map((b) => b.program);
    const list = visibleMaterials(s.db.materials, role, userId, programs);
    const email = s.me?.email || "user";
    return (<>
      <PageHeader title="Learning Materials" subtitle="Protected, view-only resources shared by the admin."/>
      <div className="mb-4">
        <Alert kind="info">
          <Lock className="mr-1 inline h-4 w-4"/> Materials are access-controlled and watermarked. Sharing screenshots or copies outside Whizzkids is not allowed.
        </Alert>
      </div>
      {list.length === 0 ? (<Empty>No materials available to you yet.</Empty>) : (<div className="grid gap-3 md:grid-cols-2">
          {list.map((m) => (<Card key={m.id} className="flex items-start justify-between gap-3 !p-4">
              <div>
                <div className="font-extrabold">{m.title}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <Badge status="booked">{m.program}</Badge> {m.fileName} · {fmtDateTime(m.uploadedAt)}
                </div>
                {m.note && <p className="mt-1 text-sm text-slate-600">{m.note}</p>}
              </div>
              <Button size="sm" onClick={() => {
                    s.logMaterialAccess(m.id, userId);
                    setOpen(m);
                }}>
                <Eye className="h-4 w-4"/> View
              </Button>
            </Card>))}
        </div>)}
      {open && <SecureViewer m={open} viewer={email} onClose={() => setOpen(null)}/>}
    </>);
}

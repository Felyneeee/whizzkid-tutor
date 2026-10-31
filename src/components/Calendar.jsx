"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useEffect, useState } from "react";
import { DAY_NAMES, MONTH_NAMES, pad, parseISO, todayISO, toISO } from "@/lib/dates";
import { cn } from "./ui";
const tone = {
    brand: "bg-brand-100 text-brand-700",
    mint: "bg-mint-100 text-mint-600",
    coral: "bg-coral-100 text-coral-600",
    sunny: "bg-sunny-100 text-sunny-500",
    slate: "bg-slate-100 text-slate-500",
};
export function Calendar({ selected = [], onSelect, isDisabled, mark, initialMonth, highlight, allowPast = false }) {
    const start = initialMonth ? parseISO(initialMonth) : new Date();
    const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });
    useEffect(() => {
        if (!initialMonth)
            return;
        const d = parseISO(initialMonth);
        setCursor({ y: d.getFullYear(), m: d.getMonth() });
    }, [initialMonth]);
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = first.getDay();
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`)];
    while (cells.length % 7)
        cells.push(null);
    const today = todayISO();
    const go = (n) => {
        const d = new Date(cursor.y, cursor.m + n, 1);
        setCursor({ y: d.getFullYear(), m: d.getMonth() });
    };
    return (<div className="w-full rounded-2xl border border-slate-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Previous month">
          <ChevronLeft className="h-4 w-4"/>
        </button>
        <div className="text-sm font-extrabold">
          {MONTH_NAMES[cursor.m]} {cursor.y}
        </div>
        <button type="button" onClick={() => go(1)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Next month">
          <ChevronRight className="h-4 w-4"/>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold uppercase text-slate-400">
        {DAY_NAMES.map((d) => (<div key={d}>{d}</div>))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((date, i) => {
            if (!date)
                return <div key={i}/>;
            const disabled = (!allowPast && date < today) || (isDisabled?.(date) ?? false);
            const sel = selected.includes(date);
            const m = mark?.(date);
            return (<button type="button" key={date} disabled={disabled || !onSelect} onClick={() => onSelect?.(date)} className={cn("flex min-h-[52px] flex-col items-center rounded-xl border p-1 text-sm font-bold transition", sel ? "border-brand-600 bg-brand-600 text-white" : "border-transparent", !sel && !disabled && "hover:border-brand-300 hover:bg-brand-50", !sel && highlight?.(date) && "bg-brand-50", disabled && "cursor-not-allowed text-slate-300", date === today && !sel && "ring-2 ring-sunny-300")}>
              <span>{Number(date.slice(8))}</span>
              {m?.text && <span className={cn("mt-0.5 rounded px-1 text-[9px] font-bold leading-4", sel ? "bg-white/25 text-white" : tone[m.tone || "brand"])}>{m.text}</span>}
              {m?.subtext && <span className={cn("max-w-full truncate rounded px-1 text-[8px] font-bold leading-3", sel ? "text-white" : tone[m.subtone || "brand"])}>{m.subtext}</span>}
            </button>);
        })}
      </div>
    </div>);
}
export { toISO };

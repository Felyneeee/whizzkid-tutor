"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useState } from "react";
import { DAY_NAMES, MONTH_NAMES, pad, parseISO, todayISO, toISO } from "@/lib/dates";
import { cn } from "./ui";
const tone = {
    brand: "bg-brand-100 text-brand-700",
    mint: "bg-mint-100 text-mint-600",
    coral: "bg-coral-100 text-coral-600",
    sunny: "bg-sunny-100 text-sunny-500",
    slate: "bg-slate-100 text-slate-500",
};
export function Calendar({ selected = [], onSelect, onMonthChange, isDisabled, mark, initialMonth, highlight, allowPast = false, readOnly = false, minMonth }) {
    const start = initialMonth ? parseISO(initialMonth) : new Date();
    const [manualCursor, setManualCursor] = useState(null);
    const cursor = manualCursor && manualCursor.initialMonth === initialMonth
        ? manualCursor.cursor
        : { y: start.getFullYear(), m: start.getMonth() };
    const first = new Date(cursor.y, cursor.m, 1);
    const lead = first.getDay();
    const days = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${cursor.y}-${pad(cursor.m + 1)}-${pad(i + 1)}`)];
    while (cells.length % 7)
        cells.push(null);
    const today = todayISO();
    const go = (n) => {
        const d = new Date(cursor.y, cursor.m + n, 1);
        setManualCursor({ initialMonth, cursor: { y: d.getFullYear(), m: d.getMonth() } });
        onMonthChange?.(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`);
    };
    return (<div className="w-full rounded-2xl border border-slate-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" disabled={!!minMonth && `${cursor.y}-${pad(cursor.m + 1)}` <= minMonth} onClick={() => go(-1)} className="rounded-lg p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30" aria-label="Previous month">
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
            const canSelect = !!onSelect && !readOnly;
            const disabled = (!allowPast && date < today) || (isDisabled?.(date) ?? false) || !canSelect;
            const sel = selected.includes(date);
            const m = mark?.(date);
            return (<button type="button" key={date} disabled={disabled} onClick={() => canSelect && onSelect(date)} className={cn("flex min-h-[52px] flex-col items-center rounded-xl border p-1 text-sm font-bold transition", sel ? "border-brand-600 bg-brand-600 text-white" : "border-transparent", canSelect && !sel && !disabled && "hover:border-brand-300 hover:bg-brand-50", !sel && highlight?.(date) && "bg-brand-50", disabled && !sel && "cursor-not-allowed text-slate-300", readOnly && "cursor-default", date === today && !sel && "ring-2 ring-sunny-300")}>
              <span className="relative block w-full leading-5">{Number(date.slice(8))}{m?.count > 0 && <span className="absolute -right-0.5 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[9px] font-extrabold leading-none text-white" aria-label={`${m.count} scheduled item${m.count === 1 ? "" : "s"}`}>{m.count}</span>}</span>
              {m?.text && <span className={cn("mt-0.5 rounded px-1 text-[9px] font-bold leading-4", sel ? "bg-white/25 text-white" : tone[m.tone || "brand"])}>{m.text}</span>}
              {m?.subtext && <span className={cn("max-w-full truncate rounded px-1 text-[8px] font-bold leading-3", sel ? "text-white" : tone[m.subtone || "brand"])}>{m.subtext}</span>}
            </button>);
        })}
      </div>
    </div>);
}
export { toISO };

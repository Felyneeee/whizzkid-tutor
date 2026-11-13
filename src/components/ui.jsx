"use client";
import clsx from "clsx";
import { X } from "lucide-react";
import React from "react";
export const cn = clsx;
export function Button({ variant = "primary", size = "md", className, ...p }) {
    const v = {
        primary: "bg-brand-600 text-white hover:bg-brand-700 shadow-sm",
        secondary: "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50",
        ghost: "text-slate-600 hover:bg-slate-100",
        danger: "bg-coral-500 text-white hover:bg-coral-600",
        success: "bg-mint-600 text-white hover:bg-mint-500",
        sunny: "bg-sunny-400 text-slate-900 hover:bg-sunny-300",
    }[variant];
    return (<button {...p} className={cn("inline-flex items-center justify-center gap-1.5 rounded-xl font-semibold transition-[color,transform] duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100", size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm", v, className)}/>);
}
export function Card({ className, children }) {
    return <div className={cn("rounded-2xl border border-slate-100 bg-white p-5 shadow-sm", className)}>{children}</div>;
}
export function PageHeader({ title, action }) {
    return (<div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      </div>
      {action}
    </div>);
}
const BADGE = {
    pending: "bg-sunny-100 text-sunny-500",
    pending_review: "bg-sunny-100 text-sunny-500",
    pending_verification: "bg-sunny-100 text-sunny-500",
    awaiting_admin: "bg-sunny-100 text-sunny-500",
    pending_assessment: "bg-sunny-100 text-sunny-500",
    assessment_scheduled: "bg-brand-100 text-brand-700",
    ready_for_matching: "bg-sunny-100 text-sunny-500",
    booked: "bg-brand-100 text-brand-700",
    interview: "bg-brand-100 text-brand-700",
    scheduled: "bg-brand-100 text-brand-700",
    approved: "bg-mint-100 text-mint-600",
    active: "bg-mint-100 text-mint-600",
    confirmed: "bg-mint-100 text-mint-600",
    completed: "bg-mint-100 text-mint-600",
    paid: "bg-mint-100 text-mint-600",
    released: "bg-mint-100 text-mint-600",
    rejected: "bg-coral-100 text-coral-600",
    terminated: "bg-coral-100 text-coral-600",
    cancelled: "bg-slate-100 text-slate-500",
    needs_reassignment: "bg-coral-100 text-coral-600",
    mastered: "bg-mint-100 text-mint-600",
    practicing: "bg-brand-100 text-brand-700",
    not_started: "bg-slate-100 text-slate-500",
    online: "bg-brand-50 text-brand-700",
    "face-to-face": "bg-sunny-50 text-sunny-500",
};
export function Badge({ status, children }) {
    return (<span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold capitalize", BADGE[status] || "bg-slate-100 text-slate-600")}>
      {children ?? status.replace(/_/g, " ")}
    </span>);
}
export function Field({ label, children }) {
    return (<label className="block">
      <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>);
}
const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";
export const Input = React.forwardRef(function Input({ className, ...p }, ref) {
    return <input ref={ref} {...p} className={cn(inputCls, className)}/>;
});
export function PhoneInput({ value = "", onChange, required = false }) {
    const digits = String(value).replace(/\D/g, "");
    const national = value.startsWith("+63") ? digits.slice(2) : digits.replace(/^0+/, "");
    return <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100">
      <div className="flex shrink-0 items-center gap-2 border-r border-slate-200 px-3">
        <span aria-hidden="true">🇵🇭</span><span className="text-sm text-slate-600">+63</span>
      </div>
      <input type="tel" inputMode="numeric" autoComplete="tel-national" required={required} value={national} onChange={(event) => onChange(`+63${event.target.value.replace(/\D/g, "")}`)} pattern="[0-9]{10}" title="Philippines phone numbers should have 10 digits after +63" placeholder="000-000-0000" className="min-w-0 flex-1 px-3 py-2 text-sm outline-none"/>
    </div>;
}
export function Textarea({ className, ...p }) {
    return <textarea {...p} className={cn(inputCls, "min-h-[80px]", className)}/>;
}
export function Select({ className, children, ...p }) {
    return (<select {...p} className={cn(inputCls, className)}>
      {children}
    </select>);
}
export function Modal({ open, onClose, title, children, wide }) {
    if (!open)
        return null;
    return (<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4" onClick={onClose}>
      <div className={cn("my-8 w-full rounded-2xl bg-white p-6 shadow-xl", wide ? "max-w-3xl" : "max-w-lg")} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-extrabold">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5"/>
          </button>
        </div>
        {children}
      </div>
    </div>);
}
export function Empty({ children }) {
    return <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">{children}</div>;
}
export function Alert({ kind = "info", children }) {
    const c = {
        info: "bg-brand-50 text-brand-800 border-brand-100",
        warn: "bg-sunny-50 text-slate-700 border-sunny-200",
        error: "bg-coral-50 text-coral-600 border-coral-100",
        success: "bg-mint-50 text-mint-600 border-mint-100",
    }[kind];
    return <div className={cn("rounded-xl border px-4 py-3 text-sm", c)}>{children}</div>;
}
export function Table({ head, children }) {
    return (<div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {head.map((h) => (<th key={h} className="whitespace-nowrap px-4 py-3 font-bold">
                {h}
              </th>))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>);
}
export const Td = ({ children, className }) => <td className={cn("px-4 py-3 align-top", className)}>{children}</td>;
export function Stat({ label, value, tone = "brand", sub }) {
    const t = { brand: "bg-brand-50 text-brand-700", sunny: "bg-sunny-50 text-sunny-500", coral: "bg-coral-50 text-coral-600", mint: "bg-mint-50 text-mint-600" }[tone];
    return (<div className={cn("rounded-2xl p-4", t)}>
      <div className="text-xs font-bold uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 text-2xl font-extrabold">{value}</div>
      {sub && <div className="text-xs opacity-70">{sub}</div>}
    </div>);
}
export function Tabs({ tabs, value, onChange }) {
    return (<div className="mb-4 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
      {tabs.map((t) => (<button key={t.id} onClick={() => onChange(t.id)} className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold transition", value === t.id ? "bg-white text-brand-700 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
          {t.label}
          {typeof t.count === "number" && t.count > 0 && <span className="ml-1.5 rounded-full bg-coral-500 px-1.5 py-0.5 text-[10px] text-white">{t.count}</span>}
        </button>))}
    </div>);
}
export function Chips({ options, value, onChange, multi }) {
    return (<div className="flex flex-wrap gap-2">
      {options.map((o) => {
            const on = value.includes(o);
            return (<button type="button" key={o} onClick={() => onChange(multi ? (on ? value.filter((x) => x !== o) : [...value, o]) : [o])} className={cn("rounded-full border px-3 py-1 text-sm font-semibold transition", on ? "border-brand-500 bg-brand-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300")}>
            {o}
          </button>);
        })}
    </div>);
}
export function Logo({ className }) {
    return (<span className={cn("inline-flex items-center gap-2 font-extrabold tracking-tight", className)}>
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-sunny-400 text-lg shadow-sm">🎓</span>
      <span>
        Whizz<span className="text-brand-600">kids</span>
      </span>
    </span>);
}
export const peso = (n) => `₱${n.toLocaleString()}`;

export const pad = (n) => String(n).padStart(2, "0");
export const firstName = (name, fallback = "—") => name?.trim().split(/\s+/)[0] || fallback;
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
};
export const todayISO = () => toISO(new Date());
export const addDays = (iso, n) => {
    const d = parseISO(iso);
    d.setDate(d.getDate() + n);
    return toISO(d);
};
export const weekday = (iso) => parseISO(iso).getDay();
export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];
export const fmtDate = (iso) => {
    const d = parseISO(iso);
    return `${DAY_NAMES[d.getDay()]}, ${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`;
};
export const fmtShort = (iso) => {
    const d = parseISO(iso);
    return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
};
export const fmtTime = (t) => {
    const [h, m] = t.split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${pad(m)} ${ap}`;
};
export const fmtDateTime = (iso) => {
    const d = new Date(iso);
    return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${fmtTime(`${d.getHours()}:${d.getMinutes()}`)}`;
};
export const rangeDates = (start, end) => {
    const out = [];
    let cur = start;
    let guard = 0;
    while (cur <= end && guard++ < 400) {
        out.push(cur);
        cur = addDays(cur, 1);
    }
    return out;
};
export const monthKey = (iso) => iso.slice(0, 7);
export const ageFromBirthday = (bday) => {
    if (!bday)
        return null;
    const b = parseISO(bday);
    const now = new Date();
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate()))
        age--;
    return age;
};
export const isBirthdayToday = (bday) => {
    if (!bday)
        return false;
    const b = parseISO(bday);
    const n = new Date();
    return b.getMonth() === n.getMonth() && b.getDate() === n.getDate();
};
export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
export const nowISO = () => new Date().toISOString();

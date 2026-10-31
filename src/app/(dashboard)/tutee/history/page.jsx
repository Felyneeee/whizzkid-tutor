"use client";
import { HistoryView } from "@/components/shared";
import { useStore } from "@/lib/store";
export default function Page() {
    const s = useStore();
    return <HistoryView userId={s.me.id}/>;
}

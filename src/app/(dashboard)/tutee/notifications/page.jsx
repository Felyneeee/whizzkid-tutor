"use client";
import { NotificationsView } from "@/components/shared";
import { useStore } from "@/lib/store";
export default function Page() {
    const s = useStore();
    return <NotificationsView userId={s.me.id}/>;
}

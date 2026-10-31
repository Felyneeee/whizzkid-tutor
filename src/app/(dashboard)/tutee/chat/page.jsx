"use client";
import { ChatView } from "@/components/shared";
import { useStore } from "@/lib/store";
export default function Page() {
    const s = useStore();
    return <ChatView meId={s.me.id} isAdmin={false}/>;
}

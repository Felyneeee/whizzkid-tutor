"use client";
import { MaterialsView } from "@/components/MaterialsView";
import { useStore } from "@/lib/store";
export default function Page() {
    const s = useStore();
    return <MaterialsView role="tutor" userId={s.me.id}/>;
}

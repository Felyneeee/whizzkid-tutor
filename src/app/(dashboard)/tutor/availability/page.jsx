"use client";
import { Card, PageHeader } from "@/components/ui";
import { useStore } from "@/lib/store";
export default function TutorSchedule() {
  const { db, me } = useStore();
  const schedule = db.tutorSchedules?.[me.id];
  return <><PageHeader title="My weekly schedule" subtitle="Your working days and day off are set by the admin. All tutors follow the standard hours."/><Card className="space-y-2">{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => <div key={day} className="flex justify-between border-b border-slate-100 py-2 text-sm"><b>{day}</b><span>{schedule?.days?.[day] ? "Working day" : "Day off"}</span></div>)}{!schedule && <p className="text-sm text-slate-500">Your weekly schedule has not been assigned yet. Please contact the admin.</p>}</Card></>;
}

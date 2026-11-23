"use client";
import { useState } from "react";
import { PageHeader, Tabs } from "@/components/ui";
import Matching from "@/app/(dashboard)/admin/matching/page";
import Assessments from "@/app/(dashboard)/admin/assessments/page";
import Classes from "@/app/(dashboard)/admin/classes/page";
import PlaygroupBookingRequests from "@/app/(dashboard)/admin/booking-requests/PlaygroupBookingRequests";
import { useStore } from "@/lib/store";

export default function BookingRequests() {
  const s = useStore();
  const [program, setProgram] = useState("academic");
  const [readingStage, setReadingStage] = useState("assessment");
  const [playgroupStage, setPlaygroupStage] = useState("schedule");
  const pendingBookings = s.db.bookings.filter((booking) => ["awaiting_admin", "ready_for_matching"].includes(booking.status));
  const academicCount = pendingBookings.filter((booking) => booking.program === "academic").length;
  const readingCount = pendingBookings.filter((booking) => booking.program === "reading").length + s.db.assessments.filter((assessment) => ["pending_admin_scheduling", "booked"].includes(assessment.status)).length;
  const playgroupCount = pendingBookings.filter((booking) => booking.program === "playgroup").length;

  return <>
    <PageHeader title="Booking Requests" />
    <Tabs tabs={[
      { id: "academic", label: "Academic Program", count: academicCount },
      { id: "reading", label: "Reading Program", count: readingCount },
      { id: "playgroup", label: "Playgroup Program", count: playgroupCount },
    ]} value={program} onChange={setProgram} />

    {program === "academic" && <Matching embedded programFilter="academic" cardLayout />}
    {program === "reading" && <>
      {readingStage === "assessment" ? <Assessments embedded onAssignTutor={() => setReadingStage("assignment")} /> : <><button type="button" onClick={() => setReadingStage("assessment")} className="mb-3 text-sm font-bold text-brand-600 hover:underline">← Back to Reading requests</button><Matching embedded programFilter="reading" /></>}
    </>}
    {program === "playgroup" && <>
      <Tabs variant="segmented" tabs={[{ id: "schedule", label: "Playgroup Schedule" }, { id: "requests", label: "Booking Requests", count: playgroupCount }]} value={playgroupStage} onChange={setPlaygroupStage} />
      {playgroupStage === "schedule" ? <Classes embedded /> : <PlaygroupBookingRequests />}
    </>}
  </>;
}

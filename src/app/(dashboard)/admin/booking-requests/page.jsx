"use client";
import { useState } from "react";
import { PageHeader, Tabs } from "@/components/ui";
import Matching from "@/app/(dashboard)/admin/matching/page";
import Assessments from "@/app/(dashboard)/admin/assessments/page";
import Classes from "@/app/(dashboard)/admin/classes/page";
import { useStore } from "@/lib/store";

export default function BookingRequests() {
  const s = useStore();
  const [program, setProgram] = useState("academic");
  const [readingStage, setReadingStage] = useState("assessment");
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

    {program === "academic" && <Matching embedded programFilter="academic" />}
    {program === "reading" && <>
      <Tabs tabs={[{ id: "assessment", label: "Initial Assessment" }, { id: "assignment", label: "Assign Tutor", count: readingCount }]} value={readingStage} onChange={setReadingStage} />
      {readingStage === "assessment" ? <Assessments embedded /> : <Matching embedded programFilter="reading" />}
    </>}
    {program === "playgroup" && <Classes embedded />}
  </>;
}

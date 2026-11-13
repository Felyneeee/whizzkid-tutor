import { matchTutors } from "@/lib/logic";

export function queueCompletedReadingBookings(state) {
  for (const booking of state.bookings) {
    if (booking.program !== "reading" || ["confirmed", "cancelled", "rejected", "expired", "terminated"].includes(booking.status)) continue;
    let assessment = state.assessments.find((entry) => entry.id === booking.assessmentId && entry.tuteeId === booking.tuteeId);
    if (!assessment) {
      assessment = [...state.assessments].reverse().find((entry) => entry.tuteeId === booking.tuteeId && ["pending_admin_scheduling", "booked", "completed"].includes(entry.status));
      if (assessment) booking.assessmentId = assessment.id;
    }
    if (assessment?.status !== "completed" && ["pending", "pending_assessment", "assessment_scheduled"].includes(booking.status)) {
      const completedAssessment = [...state.assessments].reverse().find((entry) => entry.tuteeId === booking.tuteeId && entry.status === "completed");
      if (completedAssessment) {
        assessment = completedAssessment;
        booking.assessmentId = completedAssessment.id;
        completedAssessment.bookingId = booking.id;
      }
    }
    if (assessment?.status === "completed") {
      if (["pending", "pending_assessment", "assessment_scheduled", "awaiting_admin"].includes(booking.status)) booking.status = "ready_for_matching";
      if (booking.status === "ready_for_matching" && !booking.recommendations?.length) {
        const matches = matchTutors(state, { program: "reading", subject: "Reading", gradeLevel: booking.gradeLevel, modality: booking.modality, learningNeeds: assessment.learningNeeds || booking.learningNeeds, dates: booking.dates, times: booking.sessionTimes, time: booking.time, ignoreBookingId: booking.id });
        booking.recommendations = matches.filter((match) => match.full).slice(0, 3).map((match) => match.tutor.userId);
      }
    } else if (["ready_for_matching", "awaiting_admin"].includes(booking.status)) {
      booking.status = assessment?.status === "booked" ? "assessment_scheduled" : "pending_assessment";
    } else if (assessment?.status === "booked" && booking.status === "pending_assessment") {
      booking.status = "assessment_scheduled";
    }
  }
}

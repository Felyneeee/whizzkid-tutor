import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser } from "@/server/auth";
import { readStateForUser, stateVisibleToUser } from "@/server/application-state";
import { queueCompletedReadingBookings } from "./reading-bookings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unpackPaymentMetadata(state) {
  for (const booking of state.bookings || []) {
    const stored = booking.scheduleProposal;
    if (stored?.__payment) {
      Object.assign(booking, stored.__payment);
      booking.scheduleProposal = stored.proposal;
    }
    if (!booking.status && booking.paymentStatus === "to_pay") booking.status = "to_pay";
    if (!booking.status && booking.paymentStatus === "awaiting_approval") booking.status = "awaiting_payment_approval";
    if (!booking.status && booking.paymentStatus === "proof_rejected") booking.status = "to_pay";
    if (booking.expiresAt && booking.paymentStatus && !booking.paymentDeadlineAt) booking.paymentDeadlineAt = booking.expiresAt;
  }
  for (const purchase of state.purchases || []) {
    const index = (purchase.items || []).findIndex((item) => item?.__paymentMeta);
    if (index >= 0) {
      const [marker] = purchase.items.splice(index, 1);
      Object.assign(purchase, marker.__paymentMeta);
    }
  }
  return state;
}

export async function GET(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const { state: loadedState, initialized } = await readStateForUser(user);
    const visibleState = unpackPaymentMetadata(structuredClone(loadedState));
    queueCompletedReadingBookings(visibleState);
    return NextResponse.json({ db: stateVisibleToUser(visibleState, user), initialized });
  } catch (error) {
    console.error("[state/read]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not load app data from MySQL." }, { status: 503 });
  }
}

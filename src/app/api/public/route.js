import { NextResponse } from "next/server";
import { readCurrentApplicationState } from "@/server/application-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { state } = await readCurrentApplicationState();
    return NextResponse.json({ hirings: state.hirings.filter((item) => item.open).map(({ id, title, desc }) => ({ id, title, desc })) });
  } catch {
    return NextResponse.json({ hirings: [] }, { status: 200 });
  }
}

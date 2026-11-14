import { NextResponse } from "next/server";
import { GRADE_LEVELS, HOURS, SUBJECTS } from "@/lib/constants";
import { slotRequestable } from "@/lib/logic";
import { authenticatedUser } from "@/server/auth";
import { readStateForUser } from "@/server/application-state";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const validDate = (value) => typeof value === "string"
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

export async function POST(request) {
  try {
    const user = await authenticatedUser(request);
    if (!user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const input = await request.json();
    const { dates, times, subjects, program, gradeLevel, modality, sessionType } = input || {};
    if (user.role !== "tutee" || !Array.isArray(dates) || dates.length > 35 || !dates.every(validDate)
      || !Array.isArray(times) || times.length > HOURS.length || !times.every((time) => HOURS.includes(time))
      || !Array.isArray(subjects) || !subjects.length || subjects.length > SUBJECTS.length + 1
      || !["academic", "reading"].includes(program) || !GRADE_LEVELS.includes(gradeLevel)
      || !["online", "face-to-face"].includes(modality)
      || !["one-on-one", "group"].includes(sessionType)
      || (program === "reading" && (sessionType !== "one-on-one" || subjects.some((subject) => subject !== "Reading")))
      || (program === "academic" && !subjects.every((subject) => SUBJECTS.includes(subject)))) {
      return NextResponse.json({ error: "Invalid availability request." }, { status: 400 });
    }

    const { state } = await readStateForUser(user);
    const available = {};
    for (const date of dates) {
      for (const time of times) {
        for (const subject of subjects) {
          const key = `${date}|${time}|${subject}`;
          available[key] = slotRequestable(state, date, time, {
            program, subject, gradeLevel, modality, sessionType,
          });
        }
      }
    }
    return NextResponse.json({ available }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[state/slot-availability]", error?.code ?? "UNKNOWN", error?.message ?? "No error detail");
    return NextResponse.json({ error: "Could not refresh slot availability." }, { status: 503 });
  }
}

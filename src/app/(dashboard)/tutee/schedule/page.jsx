"use client";
import { Star } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, Empty, Modal, PageHeader, Table, Td, Textarea, cn } from "@/components/ui";
import { firstName, fmtDate, fmtDateTime, fmtTime, todayISO } from "@/lib/dates";
import { cohortSessionDates } from "@/lib/logic";
import { useStore } from "@/lib/store";
export default function TuteeSchedule() {
    const s = useStore();
    const id = s.me.id;
    const [rating, setRating] = useState(null);
    const [checkInErrors, setCheckInErrors] = useState({});
    const sessions = s.db.sessions.filter((x) => x.tuteeId === id).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const bookings = s.db.bookings.filter((b) => b.tuteeId === id && b.status !== "awaiting_admin");
    const tutor = (tid) => firstName(s.db.tutors.find((t) => t.userId === tid)?.fullName);
    const subj = (bid) => s.db.bookings.find((b) => b.id === bid)?.subject || "";
    const today = todayISO();
    return (<>
      <PageHeader title="My schedule" subtitle="Confirmed matches are added automatically."/>
      {sessions.length === 0 ? (<Empty>No sessions yet.</Empty>) : (<Table head={["Date", "Time", "Subject", "Tutor", "Mode", "Status", ""]}>
          {sessions.map((x) => (<tr key={x.id} className={x.date < today ? "text-slate-500" : ""}>
              <Td>{fmtDate(x.date)}</Td>
              <Td>{fmtTime(x.time)}</Td>
              <Td>{subj(x.bookingId)}</Td>
              <Td>{tutor(x.tutorId)}</Td>
              <Td><Badge status={x.modality}/></Td>
              <Td><Badge status={x.status}/></Td>
              <Td>
                {x.status === "scheduled" && x.date === today && !x.tuteeCheckedInAt && (<Button size="sm" variant="success" onClick={async () => {
                        const result = await s.checkInSession(x.id, id);
                        if (!result.ok)
                            setCheckInErrors((current) => ({ ...current, [x.id]: result.error }));
                    }}>I&apos;ve arrived · Check in</Button>)}
                {x.tuteeCheckedInAt && <span className="text-xs font-semibold text-mint-600">Checked in {fmtDateTime(x.tuteeCheckedInAt)}</span>}
                {checkInErrors[x.id] && <span className="text-xs text-coral-600">{checkInErrors[x.id]}</span>}
                {x.status === "completed" && !x.rating && (<Button size="sm" variant="sunny" onClick={() => setRating({ id: x.id, stars: 5, text: "" })}>
                    Rate
                  </Button>)}
                {x.rating && <span className="text-sunny-500">{"★".repeat(x.rating)}</span>}
              </Td>
            </tr>))}
        </Table>)}

      <h2 className="mb-3 mt-8 text-lg font-extrabold">Bookings & contracts</h2>
      {bookings.length === 0 ? (<Empty>No bookings.</Empty>) : (<div className="grid gap-3 md:grid-cols-2">
          {bookings.map((b) => {
                const cohort = b.cohortId ? s.db.cohorts.find((c) => c.id === b.cohortId) : null;
                return (<Card key={b.id} className="!p-4">
                <div className="flex items-center justify-between">
                  <div className="font-extrabold">{cohort ? cohort.label : `${b.subject} (${b.bookingType})`}</div>
                  <Badge status={b.status}/>
                </div>
                <div className="mt-1 text-sm text-slate-500">
                  {b.tutorId ? `Tutor: ${tutor(b.tutorId)}` : "Tutor to be assigned"} · {b.dates.length} session(s)
                </div>
                {!cohort && <div className="mt-1 text-xs text-slate-500">{b.dates.map((date) => `${fmtDate(date)} · ${fmtTime(b.sessionTimes?.[date] ?? b.time)}`).join(" · ")}</div>}
                {cohort && <div className="mt-1 text-xs text-slate-400">{cohortSessionDates(cohort).slice(0, 3).map(fmtDate).join(" · ")} …</div>}
                {b.terminationReason && <div className="mt-1 text-xs text-coral-600">{b.terminationReason}</div>}
              </Card>);
            })}
        </div>)}

      <Modal open={!!rating} onClose={() => setRating(null)} title="Rate your tutor">
        {rating && (<div className="space-y-4">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (<button key={n} onClick={() => setRating({ ...rating, stars: n })} aria-label={`${n} stars`}>
                  <Star className={cn("h-8 w-8", n <= rating.stars ? "fill-sunny-400 text-sunny-400" : "text-slate-300")}/>
                </button>))}
            </div>
            <Textarea placeholder="Share feedback (optional)" value={rating.text} onChange={(e) => setRating({ ...rating, text: e.target.value })}/>
            <Button onClick={() => {
                s.rateSession(rating.id, rating.stars, rating.text);
                setRating(null);
            }}>
              Submit rating
            </Button>
          </div>)}
      </Modal>
    </>);
}

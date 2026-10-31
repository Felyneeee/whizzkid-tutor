"use client";
import Link from "next/link";
import { useState } from "react";
import { Alert, Button, Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { GRADE_LEVELS } from "@/lib/constants";
import { ageFromBirthday } from "@/lib/dates";
import { useStore } from "@/lib/store";
export default function TuteeProfile() {
    const s = useStore();
    const id = s.me.id;
    const p = s.db.tutees.find((t) => t.userId === id);
    const [f, setF] = useState({ fullName: p.fullName, birthday: p.birthday, gradeLevel: p.gradeLevel, contact: p.contact, guardianName: p.guardianName });
    const [saved, setSaved] = useState(false);
    const age = f.birthday ? ageFromBirthday(f.birthday) : null;
    const set = (k) => (e) => {
        setF({ ...f, [k]: e.target.value });
        setSaved(false);
    };
    return (<>
      <PageHeader title="Child profile" subtitle="Basic information used for matching and booking."/>
      <Card className="max-w-2xl">
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={(e) => {
            e.preventDefault();
            s.saveTuteeProfile(id, f);
            setSaved(true);
        }}>
          <Field label="Child's full name">
            <Input required value={f.fullName} onChange={set("fullName")}/>
          </Field>
          <Field label="Birthday" hint={age !== null ? `Age: ${age}` : undefined}>
            <Input type="date" required max={new Date().toISOString().slice(0, 10)} value={f.birthday} onChange={set("birthday")}/>
          </Field>
          <Field label="Grade level">
            <Select required value={f.gradeLevel} onChange={set("gradeLevel")}>
              <option value="">Select…</option>
              {GRADE_LEVELS.map((g) => (<option key={g}>{g}</option>))}
            </Select>
          </Field>
          <Field label="Contact number">
            <Input required value={f.contact} onChange={set("contact")}/>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Parent / guardian name">
              <Input value={f.guardianName} onChange={set("guardianName")}/>
            </Field>
          </div>
          <div className="space-y-3 sm:col-span-2">
            {saved && (<Alert kind="success">
                Profile saved.{" "}
                <Link href="/tutee/book" className="font-bold underline">
                  Book a program →
                </Link>
              </Alert>)}
            <Button type="submit">Save profile</Button>
          </div>
        </form>
      </Card>
    </>);
}

import Link from "next/link";
import { Card } from "@/components/ui";
export default function RegisterChoice() {
    return (<div className="space-y-4">
      <h1 className="text-center text-2xl font-extrabold">Join Whizzkids</h1>
      <Link href="/register/tutee" className="block">
        <Card className="transition hover:border-brand-300 hover:shadow-md">
          <div className="text-3xl">👨‍👩‍👧</div>
          <h2 className="mt-1 text-lg font-extrabold">I&apos;m a parent / tutee</h2>
          <p className="text-sm text-slate-500">Enroll your child in Playgroup, Reading Programs or Academic Tutorials.</p>
        </Card>
      </Link>
      <Link href="/register/tutor" className="block">
        <Card className="transition hover:border-brand-300 hover:shadow-md">
          <div className="text-3xl">🧑‍🏫</div>
          <h2 className="mt-1 text-lg font-extrabold">I&apos;m a tutor</h2>
          <p className="text-sm text-slate-500">Apply as a new tutor, or register as an existing Whizzkids tutor.</p>
        </Card>
      </Link>
      <p className="text-center text-sm text-slate-500">
        Already have an account?{" "}
        <Link href="/login" className="font-bold text-brand-600">
          Log in
        </Link>
      </p>
    </div>);
}

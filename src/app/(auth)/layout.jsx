import Link from "next/link";
import { Logo } from "@/components/ui";
export default function AuthLayout({ children }) {
    return (<div className="min-h-screen px-4 py-8">
      <div className="mx-auto mb-6 flex max-w-xl justify-center">
        <Link href="/">
          <Logo className="text-2xl"/>
        </Link>
      </div>
      <div className="mx-auto max-w-xl">{children}</div>
    </div>);
}

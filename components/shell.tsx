import Link from "next/link";
import type { LabStatus } from "@/lib/types";
import { TimezoneSync } from "@/components/timezone-sync";

export function Shell({
  status,
  active,
  children,
}: {
  status: LabStatus;
  active: "roll" | "library" | "setup";
  children: React.ReactNode;
}) {
  const links = [
    { href: "/", id: "roll" as const, label: "ROLL" },
    { href: "/library", id: "library" as const, label: "LIBRARY" },
    { href: "/setup", id: "setup" as const, label: "SETUP" },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-6 sm:px-8">
      <TimezoneSync />
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="meta text-xs tracking-[0.3em]">LOCAL LAB</p>
          <Link href="/" className="display block text-5xl leading-none sm:text-6xl">
            ROLLDEEP
          </Link>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              className={`brutal-sm press whitespace-nowrap px-3 py-2 text-sm font-bold ${
                active === link.id ? "bg-[#ffe600] text-[#0a0a0a]" : "bg-[#f4efe4] text-[#0a0a0a]"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="brutal-sm whitespace-nowrap bg-[#ff3b1f] px-3 py-2 text-[#f4efe4]">
            <span className="meta text-xs tracking-widest">STREAK</span>
            <span className="display ml-2 text-2xl leading-none">{status.currentStreak}</span>
          </div>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="meta mt-16 border-t-4 border-[var(--ink)] pt-4 text-xs">
        {status.homeDir} · {status.available} LEFT · {status.completed} DONE
      </footer>
    </div>
  );
}

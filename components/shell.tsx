import Link from "next/link";
import type { LabStatus } from "@/lib/types";
import { TimezoneSync } from "@/components/timezone-sync";
import { SyllabusSwitch } from "@/components/syllabus-switch";
import { ProgressBar } from "@/components/progress-bar";

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
  const current =
    (status.syllabi ?? []).find((item) => item.id === status.activeSyllabusId) ?? null;
  const completed = current?.completed ?? status.completed;
  const total = current?.unitCount ?? 0;

  return (
    <div className="min-h-screen">
      <TimezoneSync />
      <header className="sticky top-0 z-40 border-b-4 border-[var(--ink)] bg-[var(--paper)]">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-4 sm:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="meta text-xs tracking-[0.3em]">LOCAL LAB</p>
              <Link href="/" className="display block text-5xl leading-none sm:text-6xl">
                ROLLDEEP
              </Link>
            </div>
            <div className="self-end sm:self-start">
              <ProgressBar completed={completed} total={total} />
            </div>
          </div>
          <nav className="flex flex-wrap items-end gap-2">
            <SyllabusSwitch syllabi={status.syllabi ?? []} activeId={status.activeSyllabusId ?? null} />
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
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        <main>{children}</main>
        <footer className="meta mt-16 border-t-4 border-[var(--ink)] pt-4 text-xs">
          {status.activeSyllabusTitle ?? "NO SYLLABUS"} · {status.available} LEFT · {status.completed}{" "}
          DONE · {status.homeDir}
        </footer>
      </div>
    </div>
  );
}

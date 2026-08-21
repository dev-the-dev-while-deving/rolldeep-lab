"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { setSyllabusAction } from "@/app/actions";
import type { SyllabusRecord } from "@/lib/types";

export function SyllabusSwitch({
  syllabi,
  activeId,
}: {
  syllabi: SyllabusRecord[];
  activeId: string | null;
}) {
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const list = syllabi ?? [];
  const active = list.find((item) => item.id === activeId) ?? list[0] ?? null;

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!active) return null;

  return (
    <div ref={rootRef} className="relative min-w-[14rem] max-w-full flex-1 sm:max-w-[22rem]">
      <p className="meta mb-1 text-[10px] tracking-[0.3em]">SYLLABUS</p>
      <button
        type="button"
        disabled={pending}
        aria-label="Switch syllabus"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="press brutal-sm flex w-full items-center justify-between gap-3 bg-[#ffe600] px-3 py-2 text-left"
      >
        <span className="display min-w-0 truncate text-sm leading-none">{active.title}</span>
        <span className="meta shrink-0 text-[10px] tracking-widest">
          {active.completed}/{active.unitCount}
          <span className="ml-2 inline-block text-xs">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open ? (
        <ul
          role="listbox"
          aria-label="Syllabi"
          className="brutal-sm absolute left-0 right-0 z-50 mt-2 max-h-72 overflow-auto bg-[var(--paper)]"
        >
          {list.map((item) => {
            const selected = item.id === active.id;
            return (
              <li key={item.id} role="none">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  disabled={pending}
                  onClick={() => {
                    setOpen(false);
                    if (item.id === active.id) return;
                    start(async () => {
                      await setSyllabusAction(item.id);
                    });
                  }}
                  className={`flex w-full items-start justify-between gap-3 border-b-[3px] border-[var(--ink)] px-3 py-3 text-left last:border-b-0 ${
                    selected ? "bg-[#ffe600]" : "bg-[var(--paper)] hover:bg-white"
                  }`}
                >
                  <span className="display min-w-0 text-sm leading-none">{item.title}</span>
                  <span className="meta shrink-0 text-[10px] tracking-widest">
                    {item.completed}/{item.unitCount}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

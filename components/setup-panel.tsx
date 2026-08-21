"use client";

import { useState, useTransition } from "react";
import { deleteAvailableAction, syncAction } from "@/app/actions";
import { Flash } from "@/components/flash";
import type { Topic } from "@/lib/types";
import { Stars } from "@/components/stars";

export function SetupPanel({
  pool,
  syllabi,
}: {
  pool: Topic[];
  syllabi: { name: string; path: string }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const visible = pool.filter((topic) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return `${topic.title} ${topic.question}`.toLowerCase().includes(q);
  });

  return (
    <div className="grid gap-8">
      <Flash error={error} ok={ok} />

      <section className="brutal bg-[var(--paper)] p-6">
        <p className="display mb-3 text-3xl">FILES</p>
        <p className="meta mb-1 text-xs">content/syllabi/ — drop source here</p>
        <p className="meta mb-4 text-xs">content/units/*.json — agent writes the pool</p>
        {syllabi.length === 0 ? (
          <p className="mb-4">NO SYLLABUS FILES YET</p>
        ) : (
          <ul className="meta mb-4 grid gap-1 text-sm">
            {syllabi.map((file) => (
              <li key={file.path}>{file.name}</li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={pending}
          className="press brutal bg-[var(--ink)] px-6 py-3 text-[var(--paper)]"
          onClick={() => {
            setError(null);
            setOk(null);
            start(async () => {
              const result = await syncAction();
              if (result.error) setError(result.error);
              else setOk(`SYNCED · ADDED ${result.added ?? 0} · SKIPPED ${result.skipped ?? 0}`);
            });
          }}
        >
          <span className="display text-2xl">{pending ? "..." : "SYNC"}</span>
        </button>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <p className="display text-3xl">POOL · {pool.length}</p>
          <input
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="FILTER"
            className="brutal-sm bg-white px-3 py-2"
          />
        </div>
        <ul className="grid gap-3">
          {visible.map((topic) => (
            <li key={topic.id} className="brutal-sm flex flex-wrap items-start justify-between gap-3 bg-[var(--paper)] p-4">
              <div>
                <Stars value={topic.stars} />
                <p className="display text-lg">{topic.title}</p>
                <p className="mt-1 text-sm">{topic.question}</p>
                <p className="meta mt-1 text-xs">{topic.minutes} MIN</p>
              </div>
              <button
                type="button"
                className="press brutal-sm bg-[var(--accent)] px-3 py-2 text-sm font-bold text-[var(--paper)]"
                onClick={() => {
                  setError(null);
                  start(async () => {
                    const result = await deleteAvailableAction(topic.id);
                    if (result.error) setError(result.error);
                  });
                }}
              >
                DELETE
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

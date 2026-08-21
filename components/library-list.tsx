"use client";

import { useMemo, useState } from "react";
import type { Topic } from "@/lib/types";
import { Stars } from "@/components/stars";

export function LibraryList({ initial }: { initial: Topic[] }) {
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    return initial.filter((topic) =>
      [topic.title, topic.question, topic.notes ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [initial, query]);

  return (
    <div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="SEARCH"
        className="brutal mb-6 w-full bg-white px-4 py-3"
      />
      <ul className="grid gap-4">
        {items.map((topic) => (
          <li key={topic.id} className="brutal bg-[var(--paper)] p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="display text-2xl">{topic.title}</p>
              <Stars value={topic.stars} />
              <p className="meta text-xs">
                {topic.completedAt
                  ? new Date(topic.completedAt).toISOString().slice(0, 10)
                  : ""}{" "}
                · {topic.minutes} MIN
              </p>
            </div>
            <p className="meta mt-2 text-xs tracking-[0.3em]">QUESTION</p>
            <p className="text-lg font-medium">{topic.question}</p>
            {topic.notes ? <p className="mt-3 whitespace-pre-wrap">{topic.notes}</p> : null}
            {topic.videoUrl ? (
              <a
                href={topic.videoUrl}
                className="meta mt-3 inline-block border-b-4 border-[var(--ink)]"
                target="_blank"
                rel="noreferrer"
              >
                PROOF
              </a>
            ) : null}
          </li>
        ))}
      </ul>
      {items.length === 0 ? <p className="meta mt-6">NO MATCHES</p> : null}
    </div>
  );
}

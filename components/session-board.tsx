"use client";

import { useState, useTransition } from "react";
import { chooseAction, rollAction } from "@/app/actions";
import { Flash } from "@/components/flash";
import { TopicCard } from "@/components/topic-card";
import { Stars } from "@/components/stars";
import type { Topic } from "@/lib/types";

export function SessionBoard({
  current,
  previous,
  rollsLeft,
  poolLeft,
}: {
  current: Topic;
  previous: Topic[];
  rollsLeft: number;
  poolLeft: number;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ error?: string }>) {
    setError(null);
    start(async () => {
      const result = await fn();
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="grid gap-6">
      <Flash error={error} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="meta text-sm tracking-[0.25em]">
          {rollsLeft} REROLLS LEFT · {poolLeft} IN POOL
        </p>
        <button
          type="button"
          disabled={pending || rollsLeft === 0}
          onClick={() => run(rollAction)}
          className="press brutal bg-[var(--accent)] px-6 py-3 text-[var(--paper)]"
        >
          <span className="display text-2xl">{pending ? "..." : "REROLL"}</span>
        </button>
      </div>

      <TopicCard topic={current} eyebrow="THIS ROLL" />
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => chooseAction(current.id))}
        className="press brutal w-full bg-[var(--ink)] px-6 py-4 text-left text-[var(--paper)]"
      >
        <span className="display text-3xl">TAKE THIS</span>
      </button>

      {previous.length > 0 ? (
        <section>
          <p className="display mb-3 text-2xl">PREVIOUS · {previous.length}/3</p>
          <ul className="grid gap-3">
            {previous.map((topic) => (
              <li key={topic.id} className="brutal-sm flex flex-wrap items-start justify-between gap-3 bg-[var(--paper)] p-4">
                <div className="min-w-0 flex-1">
                  <Stars value={topic.stars} />
                  <p className="meta text-xs tracking-[0.3em]">TOPIC</p>
                  <p className="display text-xl">{topic.title}</p>
                  <p className="meta mt-2 text-xs tracking-[0.3em]">QUESTION</p>
                  <p className="text-sm">{topic.question}</p>
                  <p className="meta mt-1 text-xs">{topic.minutes} MIN</p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  className="press brutal-sm bg-[var(--ink)] px-3 py-2 text-sm font-bold text-[var(--paper)]"
                  onClick={() => run(() => chooseAction(topic.id))}
                >
                  TAKE
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

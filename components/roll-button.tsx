"use client";

import { useState, useTransition } from "react";
import { rollAction } from "@/app/actions";
import { Flash } from "@/components/flash";

export function RollButton({ disabled, remaining }: { disabled: boolean; remaining: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center gap-8 py-10">
      <Flash error={error} />
      <button
        type="button"
        disabled={disabled || pending}
        onClick={() => {
          setError(null);
          start(async () => {
            const result = await rollAction();
            if (result.error) setError(result.error);
          });
        }}
        className="press display brutal bg-[var(--accent)] px-10 py-8 text-7xl text-[var(--paper)] sm:px-16 sm:text-9xl"
      >
        {pending ? "..." : "ROLL"}
      </button>
      <p className="meta text-sm tracking-[0.25em]">
        {remaining === 0 ? "POOL EMPTY" : `${remaining} LEFT`}
      </p>
    </div>
  );
}

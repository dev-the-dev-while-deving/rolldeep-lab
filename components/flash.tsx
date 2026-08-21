"use client";

import { useState } from "react";

export function useFlash() {
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  return { error, ok, setError, setOk };
}

export function Flash({ error, ok }: { error?: string | null; ok?: string | null }) {
  if (!error && !ok) return null;
  return (
    <div
      className={`brutal mb-6 px-4 py-3 font-bold ${
        error ? "bg-[var(--accent)] text-[var(--paper)]" : "bg-[var(--signal)]"
      }`}
    >
      {error ?? ok}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { completeAction } from "@/app/actions";
import { Flash } from "@/components/flash";

export function CompleteForm({ topicId }: { topicId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="press brutal mt-6 w-full bg-[var(--ink)] px-6 py-4 text-left text-[var(--paper)]"
      >
        <span className="display text-3xl">MARK COMPLETED</span>
      </button>
    );
  }

  return (
    <form
      className="brutal mt-6 bg-[var(--paper)] p-6"
      action={(formData) => {
        setError(null);
        start(async () => {
          const result = await completeAction(formData);
          if (result.error) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="id" value={topicId} />
      <p className="display mb-4 text-2xl">PROOF</p>
      <Flash error={error} />
      <label className="meta mb-1 block text-xs tracking-widest">VIDEO URL</label>
      <input
        name="videoUrl"
        type="url"
        placeholder="https://"
        className="brutal-sm mb-4 w-full bg-white px-3 py-3"
      />
      <label className="meta mb-1 block text-xs tracking-widest">OR FILE</label>
      <input name="file" type="file" className="brutal-sm mb-4 w-full bg-white px-3 py-3" />
      <label className="meta mb-1 block text-xs tracking-widest">NOTES</label>
      <textarea name="notes" rows={5} className="brutal-sm mb-4 w-full bg-white px-3 py-3" />
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={pending}
          className="press brutal bg-[var(--accent)] px-6 py-3 text-[var(--paper)]"
        >
          <span className="display text-2xl">{pending ? "..." : "DONE"}</span>
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="press brutal bg-[var(--paper)] px-6 py-3"
        >
          <span className="display text-2xl">CANCEL</span>
        </button>
      </div>
    </form>
  );
}

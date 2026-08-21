export function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const safeTotal = Math.max(0, total);
  const safeDone = Math.min(Math.max(0, completed), safeTotal);
  const pct = safeTotal > 0 ? Math.round((safeDone / safeTotal) * 100) : 0;

  return (
    <div
      className="brutal-sm w-[14rem] shrink-0 bg-[var(--paper)] p-3"
      role="progressbar"
      aria-label="Syllabus progress"
      aria-valuemin={0}
      aria-valuemax={safeTotal || 1}
      aria-valuenow={safeDone}
      aria-valuetext={`${safeDone} of ${safeTotal} complete`}
    >
      <div className="flex items-end justify-between gap-3">
        <p className="meta text-[10px] tracking-[0.3em]">PROGRESS</p>
        <p className="display text-2xl leading-none">
          {safeDone}/{safeTotal}
        </p>
      </div>
      <div className="mt-2 h-4 overflow-hidden border-[3px] border-[var(--ink)] bg-white">
        <div
          className="h-full bg-[var(--accent)]"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

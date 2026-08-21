export function Stars({ value }: { value: number }) {
  const filled = Math.min(5, Math.max(1, Math.round(value)));
  return (
    <p className="meta text-lg tracking-widest" aria-label={`${filled} of 5 hardness`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < filled ? "text-[#0a0a0a]" : "text-[#0a0a0a]/25"}>
          ★
        </span>
      ))}
    </p>
  );
}

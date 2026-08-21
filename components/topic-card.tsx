import type { Topic } from "@/lib/types";
import { Stars } from "@/components/stars";

export function TopicCard({
  topic,
  eyebrow,
}: {
  topic: Topic;
  eyebrow?: string;
}) {
  return (
    <article className="brutal bg-[var(--paper)] p-6 sm:p-10">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <p className="meta text-xs tracking-[0.35em]">{eyebrow ?? "IN PROGRESS"}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Stars value={topic.stars} />
          <p className="brutal-sm bg-[var(--signal)] px-3 py-1">
            <span className="meta text-xl font-bold">{topic.minutes} MIN</span>
          </p>
        </div>
      </div>
      <p className="meta mb-2 text-xs tracking-[0.35em]">TOPIC</p>
      <h1 className="display text-4xl leading-[0.95] sm:text-6xl">{topic.title}</h1>
      <p className="meta mt-8 mb-2 text-xs tracking-[0.35em]">QUESTION</p>
      <p className="max-w-3xl text-2xl font-medium leading-snug sm:text-3xl">{topic.question}</p>
    </article>
  );
}

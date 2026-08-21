import Link from "next/link";
import { getLab } from "@/lib/lab";
import { Shell } from "@/components/shell";
import { RollButton } from "@/components/roll-button";
import { TopicCard } from "@/components/topic-card";
import { CompleteForm } from "@/components/complete-form";
import { SessionBoard } from "@/components/session-board";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const status = getLab().status();

  return (
    <Shell status={status} active="roll">
      {status.inProgress ? (
        <>
          <TopicCard topic={status.inProgress} />
          <CompleteForm topicId={status.inProgress.id} />
        </>
      ) : status.current ? (
        <SessionBoard
          current={status.current}
          previous={status.previous}
          rollsLeft={status.rollsLeft}
          poolLeft={status.available}
        />
      ) : status.available === 0 ? (
        <div className="brutal bg-[var(--signal)] p-10">
          <p className="display text-6xl">POOL EMPTY</p>
          <Link href="/setup" className="press brutal mt-8 inline-block bg-[var(--ink)] px-6 py-3 text-[var(--paper)]">
            <span className="display text-2xl">SETUP</span>
          </Link>
        </div>
      ) : (
        <RollButton disabled={false} remaining={status.available} />
      )}
    </Shell>
  );
}

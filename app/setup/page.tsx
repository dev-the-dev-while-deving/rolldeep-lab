import { getLab } from "@/lib/lab";
import { listSyllabi } from "@/lib/content";
import { Shell } from "@/components/shell";
import { SetupPanel } from "@/components/setup-panel";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  const store = getLab();
  const status = store.status();
  const pool = store.pool();
  const files = listSyllabi();

  return (
    <Shell status={status} active="setup">
      <h1 className="display mb-6 text-5xl">SETUP</h1>
      <SetupPanel
        pool={pool}
        files={files}
        catalog={status.syllabi}
        activeId={status.activeSyllabusId}
      />
    </Shell>
  );
}

import { getLab } from "@/lib/lab";
import { Shell } from "@/components/shell";
import { LibraryList } from "@/components/library-list";

export const dynamic = "force-dynamic";

export default function LibraryPage() {
  const store = getLab();
  const status = store.status();
  const items = store.library();

  return (
    <Shell status={status} active="library">
      <h1 className="display mb-6 text-5xl">LIBRARY</h1>
      {items.length === 0 ? (
        <div className="brutal bg-[var(--signal)] p-8">
          <p className="display text-4xl">NOTHING COMPLETED YET</p>
        </div>
      ) : (
        <LibraryList initial={items} />
      )}
    </Shell>
  );
}

import { syncContent } from "@/lib/content";
import { getStore, type Store } from "@/lib/store";

export function getLab(): Store {
  const store = getStore();
  syncContent(store);
  return store;
}

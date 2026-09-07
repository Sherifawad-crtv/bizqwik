// Minimal pub-sub so every `useAsync` consumer revalidates after any mutation,
// no matter which component (e.g. the persistent FAB) triggered it.
let version = 0;
const listeners = new Set<() => void>();

export function bump() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion() {
  return version;
}

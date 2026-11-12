import { EmptyState } from "../../components/EmptyState";
import { useCurrentLocation } from "../../lib/locations";

export const iconBtn = (danger?: boolean): React.CSSProperties => ({
  width: 36,
  height: 36,
  flex: "none",
  borderRadius: 999,
  border: 0,
  background: danger ? "var(--danger-bg)" : "var(--primary-tint)",
  color: danger ? "var(--danger-fg)" : "var(--primary-pressed)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
});

export function PanelHeader({ title, count, action }: { title: string; count: number; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>{title}</span>
      <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{count}</span>
      {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  );
}

export function EmptyRow({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  const [title, ...rest] = text.split(". ");
  return <EmptyState bare icon="tag" title={title.replace(/\.$/, "")} body={rest.join(". ") || undefined} action={action} />;
}

// ---------- Classes (recurring series) ----------

/** With 2+ locations, the location the Plans tab is showing; else null (all). */
export function useCatalogHere(): string | null {
  const { locations, current } = useCurrentLocation();
  return locations.length > 1 ? (current?.id ?? null) : null;
}

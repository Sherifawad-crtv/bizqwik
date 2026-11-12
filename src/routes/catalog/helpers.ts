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

/** With 2+ locations, the location the Plans tab is showing; else null (all). */
export function useCatalogHere(): string | null {
  const { locations, current } = useCurrentLocation();
  return locations.length > 1 ? (current?.id ?? null) : null;
}

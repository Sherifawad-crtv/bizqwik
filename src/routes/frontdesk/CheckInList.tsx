import { useCurrentLocation } from "../../lib/locations";
import { useMemo, useState } from "react";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import type { ClientWithPackage } from "../../lib/types";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { EmptyState } from "../../components/EmptyState";
import { Card, PlanPill, SearchField, matchesClient, planSummary } from "./shared";
import { useFrontDeskCatalog } from "./Members";

type Result = { state: "busy" } | { state: "done"; note: string } | { state: "error"; text: string };

/** Everyone, searchable, each with a Check in button — for the person who
 * walked in without scanning. Each row answers for itself. */
export function CheckInList() {
  // Where this check-in happens (businesses with locations).
  const { current: here } = useCurrentLocation();
  const { data } = useAsync(() => api.clients(), []);
  const { bundleTypes } = useFrontDeskCatalog();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Record<string, Result>>({});
  const shown = useMemo(() => (data?.clients ?? []).filter((c) => matchesClient(c, query)).slice(0, 40), [data, query]);

  const checkIn = async (c: ClientWithPackage) => {
    setResults((r) => ({ ...r, [c.id]: { state: "busy" } }));
    try {
      const res = await api.checkIn(c.id, "manual", here?.id);
      const p = res.plan;
      const note = res.deducted && p ? `${p.creditsRemaining} of ${p.creditsTotal} sessions left` : "Checked in";
      setResults((r) => ({ ...r, [c.id]: { state: "done", note } }));
    } catch (err) {
      setResults((r) => ({ ...r, [c.id]: { state: "error", text: err instanceof Error ? err.message : "Couldn't check in." } }));
    }
  };

  if (!data) return <Spinner />;

  return (
    <div>
      <SearchField value={query} onChange={setQuery} placeholder="Search name or phone" />
      <Card style={{ marginTop: 10, overflow: "hidden" }}>
        {shown.map((c, i) => {
          const plan = planSummary(c, bundleTypes);
          const r = results[c.id];
          return (
            <div key={c.id} data-testid="checkin-row" style={{ padding: "12px 16px", borderBottom: i === shown.length - 1 ? "none" : "1px solid var(--line)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2 }}>
                    <PlanPill tone={plan.tone} />
                    <span style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{plan.detail}</span>
                  </div>
                </div>
                {r?.state === "done" ? (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--paid-fg)", font: "800 14px var(--font-body)", flex: "none" }}>
                    <Icon name="check" size={18} /> Done
                  </span>
                ) : (
                  <button
                    data-tap
                    disabled={r?.state === "busy"}
                    onClick={() => checkIn(c)}
                    style={{ flex: "none", height: 42, padding: "0 18px", border: 0, borderRadius: 999, background: "var(--primary)", color: "#fff", font: "700 14px var(--font-body)", cursor: "pointer", opacity: r?.state === "busy" ? 0.6 : 1 }}
                  >
                    {r?.state === "busy" ? "…" : "Check in"}
                  </button>
                )}
              </div>
              {r?.state === "done" && <div style={{ font: "400 12px var(--font-mono)", color: "var(--paid-fg)", marginTop: 6 }}>{r.note}</div>}
              {r?.state === "error" && (
                <div role="alert" style={{ font: "600 12px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 10, padding: "8px 10px", marginTop: 8 }}>
                  {r.text}
                </div>
              )}
            </div>
          );
        })}
        {shown.length === 0 &&
          (data.clients.length === 0 ? (
            <EmptyState bare icon="clients" title="No clients yet" body="Add your first client with New client, or import your members." />
          ) : (
            <EmptyState bare icon="search" title={`No one matches “${query.trim()}”`} body="Check the spelling, or search by phone number." />
          ))}
      </Card>
    </div>
  );
}

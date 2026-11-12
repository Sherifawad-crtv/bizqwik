import { EmptyState } from "../../components/EmptyState";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { egp } from "../../lib/format";
import { Spinner } from "../../components/Spinner";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Card, SectionTitle, StatusPill } from "./shared";
import { CreateOrgSheet } from "./CreateOrgSheet";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div className="bq-label">{label}</div>
      <div style={{ font: "800 var(--fs-title)/1.1 var(--font-body)", letterSpacing: "-.02em", marginTop: 6 }} className="tabular">{value}</div>
    </Card>
  );
}

export function Overview() {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const summary = useAsync(() => api.ops.summary(), []);
  const orgsRes = useAsync(() => api.ops.orgs(), []);
  const plansRes = useAsync(() => api.ops.plans(), []);

  if (summary.loading || orgsRes.loading) return <Spinner />;

  const s = summary.data;
  const orgs = orgsRes.data?.orgs ?? [];
  const plans = plansRes.data?.plans ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <div>
          <div className="bq-label">BIZQWIK OPS</div>
          <div style={{ font: "800 var(--fs-display)/1.1 var(--font-body)", letterSpacing: "-.02em", marginTop: 4 }}>Overview</div>
        </div>
        <Button onClick={() => setSheetOpen(true)} style={{ marginLeft: "auto" }}>
          <Icon name="plus" size={18} /> New org
        </Button>
      </div>

      {s && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 26 }}>
          <StatTile label="ORGANIZATIONS" value={String(s.totalOrgs)} />
          <StatTile label="ACTIVE" value={String(s.activeOrgs)} />
          <StatTile label="TOTAL GMV" value={egp(s.totalGmv)} />
          <StatTile label="BIZQWIK MRR" value={egp(s.bizqwikRevenue)} />
        </div>
      )}

      <SectionTitle count={orgs.length}>Organizations</SectionTitle>
      <Card style={{ overflow: "hidden" }}>
        {orgs.map((o, i) => (
          <button
            key={o.id}
            onClick={() => navigate(`/bizqwik/orgs/${o.id}`)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              width: "100%",
              padding: "16px 18px",
              border: 0,
              borderBottom: i === orgs.length - 1 ? "none" : "1px solid var(--line)",
              background: "none",
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div className="bq-grow">
              <div style={{ font: "700 var(--fs-base) var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{o.name}</div>
              <div className="bq-meta">
                {o.planName ?? "No plan"} · {o.staffCount} staff · {o.clientCount} clients
              </div>
            </div>
            <div style={{ textAlign: "right", flex: "none" }}>
              <div style={{ font: "700 var(--fs-body) var(--font-body)" }} className="tabular">{egp(o.gmv)}</div>
              <div style={{ marginTop: 4 }}>
                <StatusPill status={o.status} />
              </div>
            </div>
            <span style={{ color: "var(--ink-faint)", display: "flex", flex: "none" }}>
              <Icon name="chevron-right" size={16} />
            </span>
          </button>
        ))}
        {orgs.length === 0 && (
          <EmptyState bare icon="home" title="No organizations yet" body="Create a gym to get started. Its department head gets an invite and sets up the rest." action={{ label: "+ New org", onClick: () => setSheetOpen(true) }} />
        )}
      </Card>

      <CreateOrgSheet open={sheetOpen} onClose={() => setSheetOpen(false)} plans={plans} onCreated={() => { summary.refetch(); orgsRes.refetch(); }} />
    </div>
  );
}

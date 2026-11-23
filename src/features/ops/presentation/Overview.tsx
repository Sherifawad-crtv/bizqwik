import { cx } from "../../../design-system/cx";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { egp } from "../../../shared/format";
import { Spinner } from "../../../design-system/components/Spinner";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { StatusPill } from "./shared";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { CreateOrgSheet } from "./CreateOrgSheet";
import { useOpsSummary, useOrgs, useSaasPlans } from "./hooks/useOps";
import "./Overview.css";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bq-ops-overview-stat-tile-card" pad="none">
      <div className="bq-label">{label}</div>
      <div className="tabular bq-ops-overview-stat-tile-title">{value}</div>
    </Card>
  );
}

export function Overview() {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);
  const summary = useOpsSummary();
  const orgsRes = useOrgs();
  const plansRes = useSaasPlans();

  if (summary.loading || orgsRes.loading) return <Spinner />;

  const s = summary.data;
  const orgs = orgsRes.data?.orgs ?? [];
  const plans = plansRes.data?.plans ?? [];

  return (
    <div>
      <div className="bq-flex bq-items-center bq-gap-3 bq-mb-5">
        <div>
          <div className="bq-label">BIZQWIK OPS</div>
          <div className="bq-stat-lg bq-mt-1">Overview</div>
        </div>
        <Button className="bq-ml-auto" onClick={() => setSheetOpen(true)}>
          <Icon name="plus" size={18} /> New org
        </Button>
      </div>

      {s && (
        <div className="bq-ops-overview-grid">
          <StatTile label="ORGANIZATIONS" value={String(s.totalOrgs)} />
          <StatTile label="ACTIVE" value={String(s.activeOrgs)} />
          <StatTile label="TOTAL GMV" value={egp(s.totalGmv)} />
          <StatTile label="BIZQWIK MRR" value={egp(s.bizqwikRevenue)} />
        </div>
      )}

      <SectionHeader count={orgs.length}>Organizations</SectionHeader>
      <Card className="bq-overflow-hidden" pad="none">
        {orgs.map((o, i) => (
          <button
            key={o.id}
            onClick={() => navigate(`/bizqwik/orgs/${o.id}`)}
            className={cx(`bq-plain bq-listrow ${!(i === orgs.length - 1) ? "bq-listrow--divider" : ""}`, "bq-ops-overview-btn")}
          >
            <div className="bq-grow">
              <div className="bq-ops-overview-title">{o.name}</div>
              <div className="bq-meta">
                {o.planName ?? "No plan"} · {o.staffCount} staff · {o.clientCount} clients
              </div>
            </div>
            <div className="bq-text-right bq-flex-none">
              <div className="tabular bq-ops-overview-title-2">{egp(o.gmv)}</div>
              <div className="bq-mt-1">
                <StatusPill status={o.status} />
              </div>
            </div>
            <span className="bq-fg-tertiary bq-flex bq-flex-none">
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

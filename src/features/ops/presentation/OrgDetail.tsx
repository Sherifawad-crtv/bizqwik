import { EmptyState } from "../../../design-system/components/EmptyState";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { egp, formatDateTime } from "../../../shared/format";
import { ROLE_LABELS } from "../../../shared/types";
import { type OrgStatus } from "../domain/types";
import { Spinner } from "../../../design-system/components/Spinner";
import { Icon } from "../../../design-system/components/Icon";
import { Segmented } from "../../../design-system/components/Segmented";
import { SelectField } from "../../../design-system/components/FormField";
import { Button } from "../../../design-system/components/Button";
import { Avatar } from "../../../design-system/components/Avatar";
import { ErrorBanner } from "../../../design-system/components/ErrorBanner";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { limitLabel } from "../domain/ops";
import { useOrg, useOrgActions, useSaasPlans } from "./hooks/useOps";
import { DeleteOrgSheet } from "./orgdetail/DeleteOrgSheet";
import { OrgAppConfig, UsageRow } from "./orgdetail/AppConfig";
import "./OrgDetail.css";

const STATUS_OPTIONS: { value: OrgStatus; label: string }[] = [
  { value: "trial", label: "TRIAL" },
  { value: "active", label: "ACTIVE" },
  { value: "paused", label: "PAUSED" },
];

export function OrgDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const detail = useOrg(id);
  const plansRes = useSaasPlans();
  const actions = useOrgActions(id, detail.data?.org ?? null);
  const { busy, error } = actions;
  const [deleting, setDeleting] = useState(false);

  if (detail.loading) return <Spinner />;
  if (detail.error || !detail.data) return <ErrorBanner text={detail.error ?? "Organization not found."} />;

  const { org, staff, pendingInvites, usage } = detail.data;
  const plans = plansRes.data?.plans ?? [];

  const setStatus = async (status: OrgStatus) => {
    if (await actions.setStatus(status)) detail.refetch();
  };
  const setMode = async (mode: "solo" | "team") => {
    if (await actions.setMode(mode)) detail.refetch();
  };
  const setPlan = async (planId: string) => {
    if (await actions.setPlan(planId)) detail.refetch();
  };

  const planOptions = [{ value: "", label: "No plan" }, ...plans.map((p) => ({ value: p.id, label: p.name }))];
  const activePlan = plans.find((p) => p.id === org.planId) ?? null;

  return (
    <div>
      <button className="bq-ops-org-detail-btn"
        onClick={() => navigate("/bizqwik")}
      >
        <Icon name="chevron-left" size={16} /> Overview
      </button>

      <div className="bq-stat-lg">{org.name}</div>
      <div className="bq-ops-org-detail-meta">
        /{org.slug} · Created {formatDateTime(org.createdAt)}
      </div>

      {error && <ErrorBanner text={error} />}

      <div className="bq-mt-6" style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
        <SectionHeader>Status</SectionHeader>
        <Segmented value={org.status} options={STATUS_OPTIONS} onChange={setStatus} />

        <div className="bq-mt-6">
          <SectionHeader>App type</SectionHeader>
          <Segmented
            value={org.mode ?? "team"}
            options={[{ value: "team", label: "TEAM" }, { value: "solo", label: "SOLO" }]}
            onChange={setMode}
          />
          <div className="bq-ops-org-detail-meta-2">
            Solo: the owner runs everything herself (Today, Members, Schedule, Money). Team: coaches, tiers and payouts.
          </div>
        </div>

        <div className="bq-mt-6">
          <SectionHeader>Plan</SectionHeader>
          <SelectField label="SAAS PLAN" value={org.planId ?? ""} options={planOptions} onChange={setPlan} placeholder="No plan" />
          {activePlan && (
            <div className="bq-ops-org-detail-meta-2">
              {egp(activePlan.price)}/mo · up to {limitLabel(activePlan.teamSizeLimit)} staff · {limitLabel(activePlan.clientSizeLimit)} clients
            </div>
          )}
        </div>
      </div>

      <OrgAppConfig id={id} />

      <div className="bq-mt-6">
        <SectionHeader>QR codes</SectionHeader>
        <Card className="bq-ops-org-detail-card" pad="none">
          <div className="bq-grow">
            <div className="bq-ops-org-detail-title">Lifetime check-in code</div>
            <div className="bq-ops-org-detail-meta-3">
              Print it for {org.name}'s front desk — members scan it in the app to check in.
            </div>
          </div>
          <Button className="bq-flex-none" variant="secondary" onClick={() => navigate(`/bizqwik/orgs/${id}/qr`)}>
            Open
          </Button>
        </Card>
        <Card className="bq-ops-org-detail-card-2" pad="none">
          <div className="bq-grow">
            <div className="bq-ops-org-detail-title">Coaches' attendance code</div>
            <div className="bq-ops-org-detail-meta-3">
              Print it for the coaches' room — coaches scan it with the + button to log their sessions.
            </div>
          </div>
          <Button className="bq-flex-none" variant="secondary" onClick={() => navigate(`/bizqwik/orgs/${id}/qr?for=coaches`)}>
            Open
          </Button>
        </Card>
      </div>

      <div className="bq-mt-6">
        <SectionHeader>Usage</SectionHeader>
        <Card className="bq-overflow-hidden" pad="none">
          <UsageRow label="GMV" value={egp(usage.gmv)} />
          <UsageRow label="Staff" value={String(usage.staffCount)} />
          <UsageRow label="Clients" value={String(usage.clientCount)} />
          <UsageRow label="Sessions logged" value={String(usage.sessionsLogged)} />
          <UsageRow label="Packages sold" value={String(usage.packagesSold)} />
          <UsageRow label="Memberships sold" value={String(usage.membershipsSold)} />
          <div className="bq-ops-org-detail-row">
            <span className="bq-ops-org-detail-text">Last activity</span>
            <span className="bq-ops-org-detail-title">{usage.lastActivity ? formatDateTime(usage.lastActivity) : "—"}</span>
          </div>
        </Card>
      </div>

      <div className="bq-mt-6">
        <SectionHeader count={staff.length}>Staff</SectionHeader>
        <Card className="bq-overflow-hidden" pad="none">
          {staff.map((p, i) => (
            <div key={p.id} className={`bq-listrow bq-listrow--compact ${!(i === staff.length - 1) ? "bq-listrow--divider" : ""}`}>
              <Avatar name={p.name} size={34} src={p.avatarUrl} />
              <div className="bq-grow">
                <div className="bq-ops-org-detail-title-2">{p.name}</div>
                <div className="bq-ops-org-detail-meta-4">{p.email}</div>
              </div>
              <span className="bq-ops-org-detail-label">{ROLE_LABELS[p.role].toUpperCase()}</span>
            </div>
          ))}
          {staff.length === 0 && (
            <EmptyState
              bare
              icon="coaches"
              title="No staff have signed up yet"
              body={pendingInvites.length > 0 ? "The invites below are waiting. Once the department head signs up with their email, they can invite the rest of the team." : "Nobody is invited yet. The department head is invited when the org is created."}
            />
          )}
        </Card>
      </div>

      {pendingInvites.length > 0 && (
        <div className="bq-mt-6">
          <SectionHeader count={pendingInvites.length}>Pending invites</SectionHeader>
          <Card className="bq-overflow-hidden" pad="none">
            {pendingInvites.map((inv, i) => (
              <div key={inv.email} className={`bq-listrow bq-listrow--compact ${!(i === pendingInvites.length - 1) ? "bq-listrow--divider" : ""}`}>
                <span className="bq-fg-tertiary bq-flex"><Icon name="envelope" size={18} /></span>
                <div className="bq-ops-org-detail-text-2">{inv.email}</div>
                <span className="bq-ops-org-detail-label-2">{ROLE_LABELS[inv.role].toUpperCase()}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div className="bq-mt-6">
        <SectionHeader>Danger zone</SectionHeader>
        <Card className="bq-ops-org-detail-card" pad="none">
          <div className="bq-grow">
            <div className="bq-ops-org-detail-title">Delete organization</div>
            <div className="bq-ops-org-detail-meta-3">
              Permanently removes {org.name} and all its staff, members, sales, sessions, wallets and points. This can't be undone.
            </div>
          </div>
          <Button className="bq-flex-none" variant="danger" onClick={() => setDeleting(true)}>
            Delete
          </Button>
        </Card>
      </div>

      <DeleteOrgSheet
        open={deleting}
        org={org}
        usage={usage}
        onClose={() => setDeleting(false)}
        onDeleted={() => navigate("/bizqwik", { replace: true })}
      />
    </div>
  );
}

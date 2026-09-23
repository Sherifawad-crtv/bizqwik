import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { egp, formatDateTime } from "../../lib/format";
import { ROLE_LABELS, type OrgStatus } from "../../lib/types";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/Icon";
import { Segmented } from "../../components/Segmented";
import { SelectField } from "../../components/FormField";
import { Avatar } from "../../components/Avatar";
import { Card, SectionTitle, ErrorBanner, limitLabel } from "./shared";

const STATUS_OPTIONS: { value: OrgStatus; label: string }[] = [
  { value: "trial", label: "TRIAL" },
  { value: "active", label: "ACTIVE" },
  { value: "paused", label: "PAUSED" },
];

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
      <span style={{ font: "600 15px var(--font-body)", color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ font: "700 15px var(--font-body)" }} className="tabular">{value}</span>
    </div>
  );
}

export function OrgDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const detail = useAsync(() => api.ops.org(id), [id]);
  const plansRes = useAsync(() => api.ops.plans(), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (detail.loading) return <Spinner />;
  if (detail.error || !detail.data) return <ErrorBanner text={detail.error ?? "Organization not found."} />;

  const { org, staff, pendingInvites, usage } = detail.data;
  const plans = plansRes.data?.plans ?? [];

  const setStatus = async (status: OrgStatus) => {
    if (status === org.status) return;
    setError(null);
    setBusy(true);
    try {
      await api.ops.setOrgStatus(id, status);
      detail.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update status.");
    } finally {
      setBusy(false);
    }
  };

  const setPlan = async (planId: string) => {
    setError(null);
    setBusy(true);
    try {
      await api.ops.setOrgPlan(id, planId || null);
      detail.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update plan.");
    } finally {
      setBusy(false);
    }
  };

  const planOptions = [{ value: "", label: "No plan" }, ...plans.map((p) => ({ value: p.id, label: p.name }))];
  const activePlan = plans.find((p) => p.id === org.planId) ?? null;

  return (
    <div>
      <button
        onClick={() => navigate("/bizqwik")}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "none", color: "var(--ink-muted)", cursor: "pointer", font: "700 14px var(--font-body)", marginBottom: 12, padding: 0 }}
      >
        <Icon name="chevron-left" size={16} /> Overview
      </button>

      <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>{org.name}</div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 6 }}>
        /{org.slug} · Created {formatDateTime(org.createdAt)}
      </div>

      {error && <ErrorBanner text={error} />}

      <div style={{ marginTop: 22, opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
        <SectionTitle>Status</SectionTitle>
        <Segmented value={org.status} options={STATUS_OPTIONS} onChange={setStatus} />

        <div style={{ marginTop: 22 }}>
          <SectionTitle>Plan</SectionTitle>
          <SelectField label="SAAS PLAN" value={org.planId ?? ""} options={planOptions} onChange={setPlan} placeholder="No plan" />
          {activePlan && (
            <div style={{ font: "500 12px/1.6 var(--font-mono)", color: "var(--ink-faint)", padding: "8px 2px 0" }}>
              {egp(activePlan.price)}/mo · up to {limitLabel(activePlan.teamSizeLimit)} staff · {limitLabel(activePlan.clientSizeLimit)} clients
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 26 }}>
        <SectionTitle>Usage</SectionTitle>
        <Card style={{ overflow: "hidden" }}>
          <UsageRow label="GMV" value={egp(usage.gmv)} />
          <UsageRow label="Staff" value={String(usage.staffCount)} />
          <UsageRow label="Clients" value={String(usage.clientCount)} />
          <UsageRow label="Sessions logged" value={String(usage.sessionsLogged)} />
          <UsageRow label="Packages sold" value={String(usage.packagesSold)} />
          <UsageRow label="Memberships sold" value={String(usage.membershipsSold)} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px" }}>
            <span style={{ font: "600 15px var(--font-body)", color: "var(--ink-muted)" }}>Last activity</span>
            <span style={{ font: "700 15px var(--font-body)" }}>{usage.lastActivity ? formatDateTime(usage.lastActivity) : "—"}</span>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 26 }}>
        <SectionTitle count={staff.length}>Staff</SectionTitle>
        <Card style={{ overflow: "hidden" }}>
          {staff.map((p, i) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i === staff.length - 1 ? "none" : "1px solid var(--line)" }}>
              <Avatar name={p.name} size={34} src={p.avatarUrl} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
              </div>
              <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-muted)", flex: "none" }}>{ROLE_LABELS[p.role].toUpperCase()}</span>
            </div>
          ))}
          {staff.length === 0 && <div style={{ padding: "22px 18px", textAlign: "center", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>No staff have signed up yet.</div>}
        </Card>
      </div>

      {pendingInvites.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <SectionTitle count={pendingInvites.length}>Pending invites</SectionTitle>
          <Card style={{ overflow: "hidden" }}>
            {pendingInvites.map((inv, i) => (
              <div key={inv.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", borderBottom: i === pendingInvites.length - 1 ? "none" : "1px solid var(--line)" }}>
                <span style={{ color: "var(--ink-faint)", display: "flex" }}><Icon name="envelope" size={18} /></span>
                <div style={{ font: "600 15px var(--font-body)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
                <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-muted)" }}>{ROLE_LABELS[inv.role].toUpperCase()}</span>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}

import { EmptyState } from "../../components/EmptyState";
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
import { Button } from "../../components/Button";
import { Avatar } from "../../components/Avatar";
import { ErrorBanner } from "../../components/ErrorBanner";
import { Card } from "../../components/Card";
import { SectionHeader } from "../../components/SectionHeader";
import { limitLabel } from "./format";
import { DeleteOrgSheet } from "./orgdetail/DeleteOrgSheet";
import { OrgAppConfig, UsageRow } from "./orgdetail/AppConfig";

const STATUS_OPTIONS: { value: OrgStatus; label: string }[] = [
  { value: "trial", label: "TRIAL" },
  { value: "active", label: "ACTIVE" },
  { value: "paused", label: "PAUSED" },
];

export function OrgDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const detail = useAsync(() => api.ops.org(id), [id]);
  const plansRes = useAsync(() => api.ops.plans(), []);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const setMode = async (mode: "solo" | "team") => {
    if (mode === (org.mode ?? "team")) return;
    setError(null);
    setBusy(true);
    try {
      await api.ops.setOrgMode(id, mode);
      detail.refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update the app type.");
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
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "none", color: "var(--color-text-secondary-default)", cursor: "pointer", font: "700 var(--text-subheadline-size) var(--font-family-body)", marginBottom: 12, padding: 0 }}
      >
        <Icon name="chevron-left" size={16} /> Overview
      </button>

      <div className="bq-stat-lg">{org.name}</div>
      <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)", marginTop: 6 }}>
        /{org.slug} · Created {formatDateTime(org.createdAt)}
      </div>

      {error && <ErrorBanner text={error} />}

      <div style={{ marginTop: 22, opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
        <SectionHeader>Status</SectionHeader>
        <Segmented value={org.status} options={STATUS_OPTIONS} onChange={setStatus} />

        <div style={{ marginTop: 22 }}>
          <SectionHeader>App type</SectionHeader>
          <Segmented
            value={org.mode ?? "team"}
            options={[{ value: "team", label: "TEAM" }, { value: "solo", label: "SOLO" }]}
            onChange={setMode}
          />
          <div style={{ font: "500 var(--text-caption-1-size)/1.6 var(--font-family-mono)", color: "var(--color-text-tertiary-default)", padding: "8px 2px 0" }}>
            Solo: the owner runs everything herself (Today, Members, Schedule, Money). Team: coaches, tiers and payouts.
          </div>
        </div>

        <div style={{ marginTop: 22 }}>
          <SectionHeader>Plan</SectionHeader>
          <SelectField label="SAAS PLAN" value={org.planId ?? ""} options={planOptions} onChange={setPlan} placeholder="No plan" />
          {activePlan && (
            <div style={{ font: "500 var(--text-caption-1-size)/1.6 var(--font-family-mono)", color: "var(--color-text-tertiary-default)", padding: "8px 2px 0" }}>
              {egp(activePlan.price)}/mo · up to {limitLabel(activePlan.teamSizeLimit)} staff · {limitLabel(activePlan.clientSizeLimit)} clients
            </div>
          )}
        </div>
      </div>

      <OrgAppConfig id={id} />

      <div style={{ marginTop: 26 }}>
        <SectionHeader>QR codes</SectionHeader>
        <Card pad="none" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div className="bq-grow">
            <div style={{ font: "700 var(--text-body-size) var(--font-family-body)" }}>Lifetime check-in code</div>
            <div style={{ font: "400 var(--text-footnote-size)/1.5 var(--font-family-mono)", color: "var(--color-text-tertiary-default)", marginTop: 2 }}>
              Print it for {org.name}'s front desk — members scan it in the app to check in.
            </div>
          </div>
          <Button variant="secondary" style={{ flex: "none" }} onClick={() => navigate(`/bizqwik/orgs/${id}/qr`)}>
            Open
          </Button>
        </Card>
        <Card pad="none" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
          <div className="bq-grow">
            <div style={{ font: "700 var(--text-body-size) var(--font-family-body)" }}>Coaches' attendance code</div>
            <div style={{ font: "400 var(--text-footnote-size)/1.5 var(--font-family-mono)", color: "var(--color-text-tertiary-default)", marginTop: 2 }}>
              Print it for the coaches' room — coaches scan it with the + button to log their sessions.
            </div>
          </div>
          <Button variant="secondary" style={{ flex: "none" }} onClick={() => navigate(`/bizqwik/orgs/${id}/qr?for=coaches`)}>
            Open
          </Button>
        </Card>
      </div>

      <div style={{ marginTop: 26 }}>
        <SectionHeader>Usage</SectionHeader>
        <Card pad="none" style={{ overflow: "hidden" }}>
          <UsageRow label="GMV" value={egp(usage.gmv)} />
          <UsageRow label="Staff" value={String(usage.staffCount)} />
          <UsageRow label="Clients" value={String(usage.clientCount)} />
          <UsageRow label="Sessions logged" value={String(usage.sessionsLogged)} />
          <UsageRow label="Packages sold" value={String(usage.packagesSold)} />
          <UsageRow label="Memberships sold" value={String(usage.membershipsSold)} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px" }}>
            <span style={{ font: "600 var(--text-body-size) var(--font-family-body)", color: "var(--color-text-secondary-default)" }}>Last activity</span>
            <span style={{ font: "700 var(--text-body-size) var(--font-family-body)" }}>{usage.lastActivity ? formatDateTime(usage.lastActivity) : "—"}</span>
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 26 }}>
        <SectionHeader count={staff.length}>Staff</SectionHeader>
        <Card pad="none" style={{ overflow: "hidden" }}>
          {staff.map((p, i) => (
            <div key={p.id} className={`bq-listrow bq-listrow--compact ${!(i === staff.length - 1) ? "bq-listrow--divider" : ""}`}>
              <Avatar name={p.name} size={34} src={p.avatarUrl} />
              <div className="bq-grow">
                <div style={{ font: "700 var(--text-body-size) var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</div>
              </div>
              <span style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".06em", color: "var(--color-text-secondary-default)", flex: "none" }}>{ROLE_LABELS[p.role].toUpperCase()}</span>
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
        <div style={{ marginTop: 26 }}>
          <SectionHeader count={pendingInvites.length}>Pending invites</SectionHeader>
          <Card pad="none" style={{ overflow: "hidden" }}>
            {pendingInvites.map((inv, i) => (
              <div key={inv.email} className={`bq-listrow bq-listrow--compact ${!(i === pendingInvites.length - 1) ? "bq-listrow--divider" : ""}`}>
                <span style={{ color: "var(--color-text-tertiary-default)", display: "flex" }}><Icon name="envelope" size={18} /></span>
                <div style={{ font: "600 var(--text-body-size) var(--font-family-body)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
                <span style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".06em", color: "var(--color-text-secondary-default)" }}>{ROLE_LABELS[inv.role].toUpperCase()}</span>
              </div>
            ))}
          </Card>
        </div>
      )}

      <div style={{ marginTop: 26 }}>
        <SectionHeader>Danger zone</SectionHeader>
        <Card pad="none" style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div className="bq-grow">
            <div style={{ font: "700 var(--text-body-size) var(--font-family-body)" }}>Delete organization</div>
            <div style={{ font: "400 var(--text-footnote-size)/1.5 var(--font-family-mono)", color: "var(--color-text-tertiary-default)", marginTop: 2 }}>
              Permanently removes {org.name} and all its staff, members, sales, sessions, wallets and points. This can't be undone.
            </div>
          </div>
          <Button variant="danger" style={{ flex: "none" }} onClick={() => setDeleting(true)}>
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

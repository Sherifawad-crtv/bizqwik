import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { egp, formatDateTime } from "../../lib/format";
import { ROLE_LABELS, type OrgStatus, type OrgConfig } from "../../lib/types";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/Icon";
import { Segmented } from "../../components/Segmented";
import { SelectField, TextField } from "../../components/FormField";
import { Button } from "../../components/Button";
import { Avatar } from "../../components/Avatar";
import { Card, SectionTitle, ErrorBanner, limitLabel } from "./shared";

const STATUS_OPTIONS: { value: OrgStatus; label: string }[] = [
  { value: "trial", label: "TRIAL" },
  { value: "active", label: "ACTIVE" },
  { value: "paused", label: "PAUSED" },
];

const POINTS_RATE_OPTIONS = [
  { value: "", label: "Off — no points" },
  { value: "5", label: "5 points / EGP" },
  { value: "10", label: "10 points / EGP" },
  { value: "15", label: "15 points / EGP" },
  { value: "20", label: "20 points / EGP" },
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

      <OrgAppConfig id={id} />

      <div style={{ marginTop: 26 }}>
        <SectionTitle>Check-in QR</SectionTitle>
        <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 15px var(--font-body)" }}>Lifetime check-in code</div>
            <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>
              Print it for {org.name}'s front desk — members scan it in the app to check in.
            </div>
          </div>
          <Button variant="secondary" style={{ flex: "none" }} onClick={() => navigate(`/bizqwik/orgs/${id}/qr`)}>
            Open
          </Button>
        </Card>
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

// The member-app configuration ops sets at onboarding: white-label branding
// (name/logo/icon/color/onboarding art) and the loyalty economy (points rate +
// wallet-credit expiry). Loads config, then hands a fresh, seeded form to
// OrgAppConfigForm — keyed by org id so switching orgs re-seeds cleanly.
function OrgAppConfig({ id }: { id: string }) {
  const cfg = useAsync(() => api.ops.orgConfig(id), [id]);
  return (
    <div style={{ marginTop: 26 }}>
      <SectionTitle>Member app</SectionTitle>
      <Card style={{ padding: 18 }}>
        {cfg.loading && <div style={{ padding: "6px 0", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>Loading…</div>}
        {cfg.error && <ErrorBanner text={cfg.error} />}
        {cfg.data && <OrgAppConfigForm key={id} id={id} initial={cfg.data} onSaved={cfg.refetch} />}
      </Card>
    </div>
  );
}

function OrgAppConfigForm({ id, initial, onSaved }: { id: string; initial: OrgConfig; onSaved: () => void }) {
  const b = initial.branding;
  const s = initial.settings;
  const [appName, setAppName] = useState(b?.appName ?? "");
  const [logoUrl, setLogoUrl] = useState(b?.logoUrl ?? "");
  const [iconUrl, setIconUrl] = useState(b?.iconUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(b?.primaryColor ?? "");
  const [asset0, setAsset0] = useState(b?.onboardingAssets?.[0] ?? "");
  const [asset1, setAsset1] = useState(b?.onboardingAssets?.[1] ?? "");
  const [asset2, setAsset2] = useState(b?.onboardingAssets?.[2] ?? "");
  const [pointsPerEgp, setPointsPerEgp] = useState(s?.pointsPerEgp != null ? String(s.pointsPerEgp) : "");
  const [ttlMonths, setTtlMonths] = useState(String(s?.walletCreditTtlMonths ?? 12));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setError(null);
    setSaved(false);
    const months = Number(ttlMonths);
    if (!Number.isFinite(months) || months < 1) {
      setError("Wallet credit expiry must be at least 1 month.");
      return;
    }
    setBusy(true);
    try {
      const onboardingAssets = [asset0, asset1, asset2].map((a) => a.trim()).filter(Boolean);
      await api.ops.setOrgBranding(id, {
        appName: appName.trim() || null,
        logoUrl: logoUrl.trim() || null,
        iconUrl: iconUrl.trim() || null,
        primaryColor: primaryColor.trim() || null,
        onboardingAssets,
      });
      await api.ops.setOrgSettings(id, pointsPerEgp === "" ? null : Number(pointsPerEgp), months);
      setSaved(true);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save member-app config.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "2px 2px 0" }}>BRANDING</div>
      <TextField label="APP NAME" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="e.g. Revolt" />
      <TextField label="LOGO URL" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
      <TextField label="ICON URL" value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://… (PWA/home-screen icon)" />
      <TextField label="PRIMARY COLOR" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#RRGGBB" />
      <TextField label="ONBOARDING ART 1" value={asset0} onChange={(e) => setAsset0(e.target.value)} placeholder="https://…" />
      <TextField label="ONBOARDING ART 2" value={asset1} onChange={(e) => setAsset1(e.target.value)} placeholder="https://…" />
      <TextField label="ONBOARDING ART 3" value={asset2} onChange={(e) => setAsset2(e.target.value)} placeholder="https://…" />

      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "10px 2px 0" }}>LOYALTY</div>
      <SelectField
        label="POINTS EARN RATE"
        value={pointsPerEgp}
        options={POINTS_RATE_OPTIONS}
        onChange={setPointsPerEgp}
        placeholder="Off — no points"
      />
      <div style={{ font: "500 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", padding: "0 2px" }}>
        Applies to desk sales; check-ins always earn 1 point. Redemption value = points ÷ rate in EGP.
      </div>
      <TextField label="WALLET CREDIT EXPIRY (MONTHS)" value={ttlMonths} onChange={(e) => setTtlMonths(e.target.value)} inputMode="numeric" placeholder="12" />

      {error && <ErrorBanner text={error} />}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save member app"}</Button>
        {saved && !busy && <span style={{ font: "600 13px var(--font-body)", color: "var(--paid-fg)" }}>Saved.</span>}
      </div>
    </div>
  );
}

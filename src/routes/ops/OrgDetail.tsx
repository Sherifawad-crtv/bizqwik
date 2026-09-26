import { EmptyState } from "../../components/EmptyState";
import { useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { egp, formatDateTime } from "../../lib/format";
import { supabase } from "../../lib/supabaseClient";
import { squareCrop } from "../../lib/image";
import { ROLE_LABELS, type OrgStatus, type OrgConfig } from "../../lib/types";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/Icon";
import { Segmented } from "../../components/Segmented";
import { SelectField, TextField } from "../../components/FormField";
import { Button } from "../../components/Button";
import { Avatar } from "../../components/Avatar";
import { Sheet } from "../../components/Sheet";
import { Card, SectionTitle, ErrorBanner, limitLabel } from "./shared";

const ORG_BRANDING_BUCKET = "org-branding";

async function uploadOrgAsset(orgId: string, assetKey: string, blob: Blob): Promise<string> {
  const path = `${orgId}/${assetKey}.jpg`;
  const { error } = await supabase.storage.from(ORG_BRANDING_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(ORG_BRANDING_BUCKET).getPublicUrl(path);
  // Cache-bust — re-uploading keeps the same path, so without this a browser
  // that already cached the old image at that URL would keep showing it.
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Image upload field for org branding: a preview tile + Upload/Replace
 * button, with a URL field underneath for pasting an existing asset's link
 * (e.g. one already hosted on a CDN) instead of uploading a new file. Both
 * paths write to the same `value`/`onChange`. */
function ImageUploadField({
  orgId,
  assetKey,
  label,
  value,
  onChange,
  hint,
}: {
  orgId: string;
  assetKey: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await squareCrop(file);
      const url = await uploadOrgAsset(orgId, assetKey, blob);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "0 2px 6px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          data-sq
          style={{
            width: 56,
            height: 56,
            flex: "none",
            borderRadius: "var(--r-input)",
            background: "var(--sunken)",
            border: "1px solid var(--line)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {value ? (
            <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Icon name="plus" size={18} style={{ color: "var(--ink-faint)" }} />
          )}
        </div>
        <input ref={fileInput} type="file" accept="image/*" onChange={onSelected} style={{ display: "none" }} />
        <Button variant="secondary" size="md" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </Button>
        {value && !busy && (
          <button
            onClick={() => onChange("")}
            style={{ border: 0, background: "none", padding: 0, cursor: "pointer", font: "600 13px var(--font-body)", color: "var(--ink-faint)" }}
          >
            Remove
          </button>
        )}
      </div>
      {hint && <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "6px 2px 0" }}>{hint}</div>}
      {error && (
        <div style={{ marginTop: 8, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <TextField label="OR PASTE A URL" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
      </div>
    </div>
  );
}

const STATUS_OPTIONS: { value: OrgStatus; label: string }[] = [
  { value: "trial", label: "TRIAL" },
  { value: "active", label: "ACTIVE" },
  { value: "paused", label: "PAUSED" },
];

// Blank earn rate = points off. Defaults: 10 pts/EGP earned, 500 pts = 1 EGP
// (2% back), 50 pts per check-in, 10,000 pts minimum, 12-month expiry.
const POINTS_DEFAULTS = { earn: "10", redeem: "500", checkin: "50", min: "10000", ttl: "12" };

const fmtNum = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function pointsPreview(earn: number, redeem: number, checkin: number, min: number): string {
  if (!earn) return "Points are off for this gym.";
  if (!redeem) return "";
  const back = (earn / redeem) * 100;
  return `≈ ${fmtNum(back)}% back on cash/card spend · a check-in is worth ${fmtNum(checkin / redeem)} EGP · members can redeem from ${fmtNum(min / redeem)} EGP (${fmtNum(min)} pts).`;
}

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
        <SectionTitle>QR codes</SectionTitle>
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
        <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 15px var(--font-body)" }}>Coaches' attendance code</div>
            <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>
              Print it for the coaches' room — coaches scan it with the + button to log their sessions.
            </div>
          </div>
          <Button variant="secondary" style={{ flex: "none" }} onClick={() => navigate(`/bizqwik/orgs/${id}/qr?for=coaches`)}>
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

      <div style={{ marginTop: 26 }}>
        <SectionTitle>Danger zone</SectionTitle>
        <Card style={{ padding: 18, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "700 15px var(--font-body)" }}>Delete organization</div>
            <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>
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

// Type-the-slug confirmation, GitHub style: the delete button only unlocks
// once the org's slug is typed exactly.
function DeleteOrgSheet({
  open,
  org,
  usage,
  onClose,
  onDeleted,
}: {
  open: boolean;
  org: { id: string; name: string; slug: string };
  usage: { staffCount: number; clientCount: number };
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === org.slug;

  const close = () => {
    if (busy) return;
    setTyped("");
    setError(null);
    onClose();
  };

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.ops.deleteOrg(org.id, typed.trim());
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this organization.");
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={close}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--danger-fg)" }}>DELETE ORGANIZATION</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 10px" }}>Delete {org.name}?</div>
      <div style={{ font: "500 14px/1.5 var(--font-body)", color: "var(--ink-muted)", marginBottom: 14 }}>
        This permanently deletes {org.name}, its {usage.staffCount} staff and {usage.clientCount} members (and their app logins), every sale, session, wallet, points balance and its branding. It can't be undone.
      </div>
      <TextField
        label={`TYPE ${org.slug.toUpperCase()} TO CONFIRM`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={org.slug}
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
      />
      {error && <div style={{ marginTop: 10 }}><ErrorBanner text={error} /></div>}
      <Button variant="danger" fullWidth size="lg" style={{ marginTop: 16 }} disabled={!matches || busy} onClick={confirm}>
        {busy ? "Deleting…" : "Delete permanently"}
      </Button>
      <Button variant="secondary" fullWidth style={{ marginTop: 8 }} disabled={busy} onClick={close}>
        Cancel
      </Button>
    </Sheet>
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
  const [earn, setEarn] = useState(s ? (s.pointsEarnPerEgp != null ? String(s.pointsEarnPerEgp) : "") : POINTS_DEFAULTS.earn);
  const [redeem, setRedeem] = useState(String(s?.pointsRedeemPerEgp ?? POINTS_DEFAULTS.redeem));
  const [checkin, setCheckin] = useState(String(s?.pointsCheckin ?? POINTS_DEFAULTS.checkin));
  const [minRedeem, setMinRedeem] = useState(String(s?.pointsMinRedeem ?? POINTS_DEFAULTS.min));
  const [pointsTtl, setPointsTtl] = useState(String(s?.pointsTtlMonths ?? POINTS_DEFAULTS.ttl));
  const [ttlMonths, setTtlMonths] = useState(String(s?.walletCreditTtlMonths ?? 12));

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setError(null);
    setSaved(false);
    const months = Number(ttlMonths);
    if (!Number.isInteger(months) || months < 1) {
      setError("Wallet credit expiry must be at least 1 month.");
      return;
    }
    const whole = (v: string) => Number.isInteger(Number(v)) && Number(v) >= 0 && v.trim() !== "";
    if (earn.trim() !== "" && (!whole(earn) || Number(earn) < 1)) {
      setError("Points earned per EGP must be a whole number of 1 or more — or blank to turn points off.");
      return;
    }
    if (!whole(redeem) || Number(redeem) < 1 || !whole(checkin) || !whole(minRedeem) || !whole(pointsTtl) || Number(pointsTtl) < 1) {
      setError("Points settings must be whole numbers (redeem rate and expiry at least 1).");
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
      await api.ops.setOrgSettings(id, {
        pointsEarnPerEgp: earn.trim() === "" ? null : Number(earn),
        pointsRedeemPerEgp: Number(redeem),
        pointsCheckin: Number(checkin),
        pointsMinRedeem: Number(minRedeem),
        pointsTtlMonths: Number(pointsTtl),
        walletCreditTtlMonths: months,
      });
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
      <ImageUploadField orgId={id} assetKey="logo" label="LOGO" value={logoUrl} onChange={setLogoUrl} hint="Shown on the sign-in screen. Square works best." />
      <ImageUploadField orgId={id} assetKey="icon" label="ICON" value={iconUrl} onChange={setIconUrl} hint="PWA / home-screen icon." />
      <TextField label="PRIMARY COLOR" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#RRGGBB" />
      <ImageUploadField orgId={id} assetKey="art-0" label="ONBOARDING ART 1" value={asset0} onChange={setAsset0} />
      <ImageUploadField orgId={id} assetKey="art-1" label="ONBOARDING ART 2" value={asset1} onChange={setAsset1} />
      <ImageUploadField orgId={id} assetKey="art-2" label="ONBOARDING ART 3" value={asset2} onChange={setAsset2} />

      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "10px 2px 0" }}>LOYALTY</div>
      <TextField label="POINTS EARNED PER 1 EGP" value={earn} onChange={(e) => setEarn(e.target.value)} inputMode="numeric" placeholder="Blank = points off" />
      <TextField label="POINTS PER 1 EGP OF WALLET CREDIT" value={redeem} onChange={(e) => setRedeem(e.target.value)} inputMode="numeric" placeholder="500" />
      <TextField label="POINTS PER CHECK-IN" value={checkin} onChange={(e) => setCheckin(e.target.value)} inputMode="numeric" placeholder="50" />
      <TextField label="MINIMUM POINTS TO REDEEM" value={minRedeem} onChange={(e) => setMinRedeem(e.target.value)} inputMode="numeric" placeholder="10000" />
      <TextField label="POINTS EXPIRE AFTER (MONTHS)" value={pointsTtl} onChange={(e) => setPointsTtl(e.target.value)} inputMode="numeric" placeholder="12" />
      <div data-testid="points-preview" style={{ font: "500 12px/1.5 var(--font-mono)", color: "var(--ink-muted)", padding: "0 2px" }}>
        {pointsPreview(Number(earn) || 0, Number(redeem) || 0, Number(checkin) || 0, Number(minRedeem) || 0)} Only cash/card purchases earn; wallet-paid ones don't, and refunds take points back.
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

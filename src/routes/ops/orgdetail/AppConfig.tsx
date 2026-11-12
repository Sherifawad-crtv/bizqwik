import { useState } from "react";
import { api } from "../../../lib/backend";
import { useAsync } from "../../../lib/useAsync";
import { type OrgConfig } from "../../../lib/types";
import { TextField } from "../../../components/FormField";
import { Button } from "../../../components/Button";
import { Card, SectionTitle, ErrorBanner } from "../shared";
import { ImageUploadField } from "./ImageUpload";

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

export function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
      <span style={{ font: "600 15px var(--font-body)", color: "var(--ink-muted)" }}>{label}</span>
      <span style={{ font: "700 15px var(--font-body)" }} className="tabular">{value}</span>
    </div>
  );
}

// The member-app configuration ops sets at onboarding: white-label branding
// (name/logo/icon/color/onboarding art) and the loyalty economy (points rate +
// wallet-credit expiry). Loads config, then hands a fresh, seeded form to
// OrgAppConfigForm — keyed by org id so switching orgs re-seeds cleanly.
export function OrgAppConfig({ id }: { id: string }) {
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
      // Keep each image on its own slide: an empty slot stays "" (the member app
      // shows the default photo there); only trailing empties are dropped.
      const onboardingAssets = [asset0, asset1, asset2].map((a) => a.trim());
      while (onboardingAssets.length && !onboardingAssets[onboardingAssets.length - 1]) onboardingAssets.pop();
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
      <ImageUploadField orgId={id} assetKey="art-0" label="ONBOARDING ART 1" value={asset0} onChange={setAsset0} hint="Shown full screen on phones. Use a tall (portrait) photo, at least 1080 px wide." />
      <ImageUploadField orgId={id} assetKey="art-1" label="ONBOARDING ART 2" value={asset1} onChange={setAsset1} hint="Shown full screen on phones. Use a tall (portrait) photo, at least 1080 px wide." />
      <ImageUploadField orgId={id} assetKey="art-2" label="ONBOARDING ART 3" value={asset2} onChange={setAsset2} hint="Shown full screen on phones. Use a tall (portrait) photo, at least 1080 px wide." />

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

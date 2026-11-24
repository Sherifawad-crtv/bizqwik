import { useState } from "react";
import { type OrgConfig } from "../../domain/types";
import { TextField } from "../../../../design-system/components/FormField";
import { Button } from "../../../../design-system/components/Button";
import { ErrorBanner } from "../../../../design-system/components/ErrorBanner";
import { Card } from "../../../../design-system/components/Card";
import { SectionHeader } from "../../../../design-system/components/SectionHeader";
import { ImageUploadField } from "./ImageUpload";
import { POINTS_DEFAULTS, pointsPreview } from "../../domain/ops";
import { useOrgConfig, useSaveAppConfig } from "../hooks/useOps";
import "./AppConfig.css";


export function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="bq-listrow bq-listrow--compact bq-listrow--divider bq-justify-between">
      <span className="bq-ops-app-config-usage-row-text">{label}</span>
      <span className="tabular bq-ops-app-config-usage-row-title">{value}</span>
    </div>
  );
}

// The member-app configuration ops sets at onboarding: white-label branding
// (name/logo/icon/color/onboarding art) and the loyalty economy (points rate +
// wallet-credit expiry). Loads config, then hands a fresh, seeded form to
// OrgAppConfigForm — keyed by org id so switching orgs re-seeds cleanly.
export function OrgAppConfig({ id }: { id: string }) {
  const cfg = useOrgConfig(id);
  return (
    <div className="bq-mt-6">
      <SectionHeader>Member app</SectionHeader>
      <Card className="bq-ops-app-config-org-app-config-card" pad="none">
        {cfg.loading && <div className="bq-ops-app-config-org-app-config-text">Loading…</div>}
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

  const { save: saveConfig, busy, error } = useSaveAppConfig(id);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setSaved(false);
    const form = { appName, logoUrl, iconUrl, primaryColor, assets: [asset0, asset1, asset2], earn, redeem, checkin, minRedeem, pointsTtl, ttlMonths };
    if (await saveConfig(form)) {
      setSaved(true);
      onSaved();
    }
  };

  return (
    <div className="bq-flex bq-col bq-gap-3" style={{ opacity: busy ? 0.6 : 1, pointerEvents: busy ? "none" : "auto" }}>
      <div className="bq-ops-app-config-org-app-config-form-label">BRANDING</div>
      <TextField label="APP NAME" value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="e.g. Revolt" />
      <ImageUploadField orgId={id} assetKey="logo" label="LOGO" value={logoUrl} onChange={setLogoUrl} hint="Shown on the sign-in screen. Square works best." />
      <ImageUploadField orgId={id} assetKey="icon" label="ICON" value={iconUrl} onChange={setIconUrl} hint="PWA / home-screen icon." />
      <TextField label="PRIMARY COLOR" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#RRGGBB" />
      <ImageUploadField orgId={id} assetKey="art-0" label="ONBOARDING ART 1" value={asset0} onChange={setAsset0} hint="Shown full screen on phones. Use a tall (portrait) photo, at least 1080 px wide." />
      <ImageUploadField orgId={id} assetKey="art-1" label="ONBOARDING ART 2" value={asset1} onChange={setAsset1} hint="Shown full screen on phones. Use a tall (portrait) photo, at least 1080 px wide." />
      <ImageUploadField orgId={id} assetKey="art-2" label="ONBOARDING ART 3" value={asset2} onChange={setAsset2} hint="Shown full screen on phones. Use a tall (portrait) photo, at least 1080 px wide." />

      <div className="bq-ops-app-config-org-app-config-form-label-2">LOYALTY</div>
      <TextField label="POINTS EARNED PER 1 EGP" value={earn} onChange={(e) => setEarn(e.target.value)} inputMode="numeric" placeholder="Blank = points off" />
      <TextField label="POINTS PER 1 EGP OF WALLET CREDIT" value={redeem} onChange={(e) => setRedeem(e.target.value)} inputMode="numeric" placeholder="500" />
      <TextField label="POINTS PER CHECK-IN" value={checkin} onChange={(e) => setCheckin(e.target.value)} inputMode="numeric" placeholder="50" />
      <TextField label="MINIMUM POINTS TO REDEEM" value={minRedeem} onChange={(e) => setMinRedeem(e.target.value)} inputMode="numeric" placeholder="10000" />
      <TextField label="POINTS EXPIRE AFTER (MONTHS)" value={pointsTtl} onChange={(e) => setPointsTtl(e.target.value)} inputMode="numeric" placeholder="12" />
      <div className="bq-ops-app-config-org-app-config-form-meta" data-testid="points-preview">
        {pointsPreview(Number(earn) || 0, Number(redeem) || 0, Number(checkin) || 0, Number(minRedeem) || 0)} Only cash/card purchases earn; wallet-paid ones don't, and refunds take points back.
      </div>
      <TextField label="WALLET CREDIT EXPIRY (MONTHS)" value={ttlMonths} onChange={(e) => setTtlMonths(e.target.value)} inputMode="numeric" placeholder="12" />

      {error && <ErrorBanner text={error} />}

      <div className="bq-flex bq-items-center bq-gap-3 bq-mt-1">
        <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save member app"}</Button>
        {saved && !busy && <span className="bq-ops-app-config-org-app-config-form-text">Saved.</span>}
      </div>
    </div>
  );
}

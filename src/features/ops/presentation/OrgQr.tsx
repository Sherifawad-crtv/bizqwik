import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { Spinner } from "../../../design-system/components/Spinner";
import { Icon } from "../../../design-system/components/Icon";
import { Button } from "../../../design-system/components/Button";
import { ErrorBanner } from "../../../design-system/components/ErrorBanner";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { Segmented } from "../../../design-system/components/Segmented";
import { qrToken } from "../domain/ops";
import { useOrg } from "./hooks/useOps";
import "./OrgQr.css";

// The lifetime check-in QR. It encodes the org's check-in token — its slug,
// which is fixed for the org's life — matching the `/client/check-in` backend
// contract (token === slug). A member opens their branded app, taps scan, and
// scans this printed code to check in and earn a point. Stays valid forever.
export function OrgQr() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const forCoaches = params.get("for") === "coaches";
  const detail = useOrg(id);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const org = detail.data?.org ?? null;
  const token = qrToken(org, forCoaches);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    setPngUrl(null);
    QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 2, width: 900 })
      .then((url) => {
        if (alive) setPngUrl(url);
      })
      .catch((err) => {
        if (alive) setQrError(err instanceof Error ? err.message : "Couldn't render the QR code.");
      });
    return () => {
      alive = false;
    };
  }, [token]);

  if (detail.loading) return <Spinner />;
  if (detail.error || !org) return <ErrorBanner text={detail.error ?? "Organization not found."} />;

  const appName = org.name;
  const copy = forCoaches
    ? { title: "Coaches' QR", sub: "Coaches log attendance", file: "coaches-qr", intro: `Lifetime code for ${org.name}'s coaches' room. Coaches scan it with the + button in the staff app to log their sessions.`, steps: `Open the staff app &nbsp;→&nbsp; tap <b>+</b> &nbsp;→&nbsp; scan this code &nbsp;→&nbsp; log your sessions`, label: "Encodes the coaches' attendance code" }
    : { title: "Check-in QR", sub: "Check in here", file: "checkin-qr", intro: `Lifetime code for ${org.name} — print it for the front desk. Members scan it in the app to check in.`, steps: `Open the <b>${escapeHtml(appName)}</b> app &nbsp;→&nbsp; tap <b>Scan</b> &nbsp;→&nbsp; point at this code`, label: `Encodes check-in code <b>${org.slug}</b>` };

  const downloadPng = () => {
    if (!pngUrl) return;
    const a = document.createElement("a");
    a.href = pngUrl;
    a.download = `${org.slug}-${copy.file}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Print / Save-as-PDF: open a clean, chrome-free document with just the
  // brand name, the QR, and instructions, sized for an A4/Letter print, and
  // trigger the browser print dialog (which offers "Save as PDF").
  const printQr = () => {
    if (!pngUrl) return;
    const w = window.open("", "_blank", "width=800,height=1000");
    if (!w) return;
    // A printable poster in its own window: the app's CSS variables don't exist
    // there, so it carries its own small print palette (exempt from tokens).
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(appName)} — ${copy.title}</title>
<style>
  @page { margin: 24mm; }
  html,body { height: 100%; margin: 0; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #16130f;
    display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 32px; }
  .name { font-size: 34px; font-weight: 800; letter-spacing: -.02em; margin: 0 0 6px; }
  .sub { font-size: 15px; color: #6b6459; margin: 0 0 28px; }
  img { width: 62vmin; max-width: 460px; height: auto; }
  .steps { font-size: 16px; color: #16130f; margin-top: 28px; line-height: 1.7; }
  .code { font-family: ui-monospace, Menlo, monospace; font-size: 13px; color: #9a9186; margin-top: 18px; letter-spacing: .04em; }
</style></head><body>
  <h1 class="name">${escapeHtml(appName)}</h1>
  <p class="sub">${copy.sub}</p>
  <img src="${pngUrl}" alt="${copy.title}" />
  <div class="steps">${copy.steps}</div>
  ${forCoaches ? "" : `<div class="code">${escapeHtml(org.slug)}</div>`}
</body></html>`);
    w.document.close();
    // Give the embedded image a tick to lay out before printing.
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div>
      <button className="bq-ops-org-qr-btn"
        onClick={() => navigate(`/bizqwik/orgs/${id}`)}
      >
        <Icon name="chevron-left" size={16} /> {org.name}
      </button>

      <div className="bq-mb-4">
        <Segmented
          value={forCoaches ? "coaches" : "members"}
          options={[{ value: "members", label: "MEMBERS" }, { value: "coaches", label: "COACHES" }]}
          onChange={(v) => setParams(v === "coaches" ? { for: "coaches" } : {}, { replace: true })}
        />
      </div>
      <div className="bq-stat-lg">{copy.title}</div>
      <div className="bq-ops-org-qr-meta">{copy.intro}</div>

      <div className="bq-ops-org-qr-size">
        <SectionHeader>Code</SectionHeader>
        <Card className="bq-ops-org-qr-card" pad="none">
          {qrError && <ErrorBanner text={qrError} />}
          {!pngUrl && !qrError && <div className="bq-ops-org-qr-text">Rendering…</div>}
          {pngUrl && (
            <>
              <img className="bq-ops-org-qr-img" src={pngUrl} alt={`${org.name} ${copy.title}`} width={260} height={260} />
              <div className="bq-ops-org-qr-title">{org.name}</div>
              <div className="bq-ops-org-qr-meta-2">
                {forCoaches ? copy.label : <>Encodes check-in code <b>{org.slug}</b></>}
              </div>
            </>
          )}
        </Card>

        <div className="bq-flex bq-gap-2 bq-mt-4">
          <Button className="bq-flex-1" onClick={printQr} disabled={!pngUrl}>
            Print / Save PDF
          </Button>
          <Button className="bq-flex-1" variant="secondary" onClick={downloadPng} disabled={!pngUrl}>
            Download PNG
          </Button>
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

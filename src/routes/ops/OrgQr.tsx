import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import QRCode from "qrcode";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/Icon";
import { Button } from "../../components/Button";
import { Card, SectionTitle, ErrorBanner } from "./shared";
import { Segmented } from "../../components/Segmented";

// The lifetime check-in QR. It encodes the org's check-in token — its slug,
// which is fixed for the org's life — matching the `/client/check-in` backend
// contract (token === slug). A member opens their branded app, taps scan, and
// scans this printed code to check in and earn a point. Stays valid forever.
export function OrgQr() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const forCoaches = params.get("for") === "coaches";
  const detail = useAsync(() => api.ops.org(id), [id]);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);

  const org = detail.data?.org ?? null;
  // Members' check-in code = the org slug; the coaches' room code is a
  // separate secret token so members can't log staff attendance (or vice versa).
  const token = (forCoaches ? org?.coachQrToken : org?.slug) ?? "";

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
      <button
        onClick={() => navigate(`/bizqwik/orgs/${id}`)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "none", color: "var(--ink-muted)", cursor: "pointer", font: "700 14px var(--font-body)", marginBottom: 12, padding: 0 }}
      >
        <Icon name="chevron-left" size={16} /> {org.name}
      </button>

      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={forCoaches ? "coaches" : "members"}
          options={[{ value: "members", label: "MEMBERS" }, { value: "coaches", label: "COACHES" }]}
          onChange={(v) => setParams(v === "coaches" ? { for: "coaches" } : {}, { replace: true })}
        />
      </div>
      <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em" }}>{copy.title}</div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginTop: 6 }}>{copy.intro}</div>

      <div style={{ marginTop: 22, maxWidth: 520 }}>
        <SectionTitle>Code</SectionTitle>
        <Card style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
          {qrError && <ErrorBanner text={qrError} />}
          {!pngUrl && !qrError && <div style={{ padding: "40px 0", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>Rendering…</div>}
          {pngUrl && (
            <>
              <img src={pngUrl} alt={`${org.name} ${copy.title}`} width={260} height={260} style={{ width: 260, height: 260, imageRendering: "pixelated" }} />
              <div style={{ font: "700 18px var(--font-body)", marginTop: 14 }}>{org.name}</div>
              <div style={{ font: "400 13px/1.6 var(--font-mono)", color: "var(--ink-faint)", marginTop: 4 }}>
                {forCoaches ? copy.label : <>Encodes check-in code <b>{org.slug}</b></>}
              </div>
            </>
          )}
        </Card>

        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <Button onClick={printQr} disabled={!pngUrl} style={{ flex: 1 }}>
            Print / Save PDF
          </Button>
          <Button variant="secondary" onClick={downloadPng} disabled={!pngUrl} style={{ flex: 1 }}>
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

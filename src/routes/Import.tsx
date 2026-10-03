import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/backend";
import { useSetHeader } from "../lib/header";
import { parseImport, TEMPLATE_CSV } from "../lib/importParse";
import type { ImportResult } from "../lib/types";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Card, ErrorBanner, SectionTitle } from "./frontdesk/shared";

/** Bring existing members in from a sheet: paste it, or choose a CSV. Plans
 * come in as history (price 0), never as new revenue. */
export function ImportMembers() {
  useSetHeader({ kicker: "SETUP", title: "Import members" }, []);
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ImportResult | null>(null);
  const parsed = useMemo(() => parseImport(text), [text]);

  const readFile = async (f: File | undefined) => {
    if (!f) return;
    setText(await f.text());
    setDone(null);
  };
  const downloadTemplate = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: "text/csv" }));
    a.download = "bizqwik-members-template.csv";
    a.click();
  };
  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setDone(await api.importClients(parsed.rows));
      setText("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't import.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div>
        <Card style={{ padding: 22, textAlign: "center" }}>
          <div style={{ font: "800 44px/1 var(--font-body)", color: "var(--paid-fg)" }}>{done.imported}</div>
          <div style={{ font: "700 16px var(--font-body)", marginTop: 6 }}>member{done.imported === 1 ? "" : "s"} imported</div>
          <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 6 }}>Their plans are in as history — no revenue was added.</div>
        </Card>
        {done.skipped.length > 0 && (
          <>
            <SectionTitle count={done.skipped.length}>Skipped</SectionTitle>
            <Card style={{ overflow: "hidden" }}>
              {done.skipped.map((s, i) => (
                <div key={i} style={{ padding: "12px 18px", borderBottom: i === done.skipped.length - 1 ? "none" : "1px solid var(--line)", font: "600 14px var(--font-body)" }}>
                  Row {s.row}: <span style={{ color: "var(--ink-muted)", fontWeight: 500 }}>{s.reason}</span>
                </div>
              ))}
            </Card>
          </>
        )}
        <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={() => navigate("/members")}>
          See my members
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ font: "400 14px/1.55 var(--font-body)", color: "var(--ink-muted)", margin: "0 2px 14px" }}>
        Copy your members from Excel or Google Sheets and paste them here, or choose a CSV file. Columns can be in any order: <b>Name</b>, Phone, Plan, Start, Expiry, Sessions left.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <label style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, height: 48, borderRadius: 999, border: "1px solid var(--line)", background: "var(--surface)", font: "700 14px var(--font-body)", cursor: "pointer" }}>
          <Icon name="plus" size={16} /> Choose a CSV
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" style={{ display: "none" }} onChange={(e) => readFile(e.target.files?.[0])} />
        </label>
        <Button variant="secondary" onClick={downloadTemplate} style={{ flex: 1 }}>
          Get the template
        </Button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"Name\tPhone\tPlan\tExpiry\nMona Ali\t01012345678\tMonthly\t30/11/2026"}
        aria-label="Paste your members"
        style={{ width: "100%", minHeight: 150, boxSizing: "border-box", padding: 14, borderRadius: "var(--r-input)", border: "1px solid var(--line)", background: "var(--sunken)", font: "400 13px/1.5 var(--font-mono)", color: "var(--ink)", resize: "vertical", outline: "none" }}
      />

      {text.trim() !== "" && (
        <>
          <SectionTitle count={parsed.rows.length}>Ready to import</SectionTitle>
          <Card style={{ overflow: "hidden" }}>
            {parsed.rows.slice(0, 6).map((r, i, arr) => (
              <div key={i} style={{ padding: "12px 18px", borderBottom: i === arr.length - 1 && parsed.rows.length <= 6 ? "none" : "1px solid var(--line)" }}>
                <div style={{ font: "700 15px var(--font-body)" }}>{r.name}</div>
                <div style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>
                  {[r.phone, r.plan, r.expiresOn ? `until ${r.expiresOn}` : null, r.creditsLeft != null ? `${r.creditsLeft} left` : null].filter(Boolean).join(" · ") || "No plan"}
                </div>
              </div>
            ))}
            {parsed.rows.length > 6 && <div style={{ padding: "12px 18px", font: "600 13px var(--font-body)", color: "var(--ink-muted)" }}>…and {parsed.rows.length - 6} more</div>}
            {parsed.rows.length === 0 && <div style={{ padding: "14px 18px", font: "600 14px var(--font-body)", color: "var(--ink-muted)" }}>Nothing readable yet.</div>}
          </Card>
          {parsed.problems.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <ErrorBanner text={parsed.problems.slice(0, 4).map((p) => `Row ${p.row}: ${p.text}`).join("  ")} />
            </div>
          )}
        </>
      )}

      {error && <ErrorBanner text={error} />}
      <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy || parsed.rows.length === 0} onClick={run}>
        {busy ? "Importing…" : parsed.rows.length > 0 ? `Import ${parsed.rows.length} member${parsed.rows.length === 1 ? "" : "s"}` : "Import"}
      </Button>
    </div>
  );
}

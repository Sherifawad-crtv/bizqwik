import { useCallback, useState, type ReactNode } from "react";
import { Icon } from "./Icon";
import { AddSessionSheet } from "./AddSessionSheet";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { SeriesSheet, PlanTypeSheet } from "../routes/Catalog";
import { BundleSheet, InviteFlow, TierSheet } from "../routes/Manage";
import { useAuth } from "../lib/auth";
import { isSoloOwner } from "../lib/nav";
import { NewClientModal } from "../routes/frontdesk/NewClientModal";
import { SoloDropIn } from "../routes/frontdesk/SoloDropIn";
import { CheckInList } from "../routes/frontdesk/CheckInList";
import { SheetHeading } from "../routes/frontdesk/shared";
import { useAsync } from "../lib/useAsync";
import { api } from "../lib/backend";
import { QrScanner } from "./QrScanner";
import { SheetSuccessIcon } from "./SheetSuccessIcon";
import { useSheetSuccess } from "../lib/useSheetSuccess";
import type { PtScanPreview } from "../lib/types";

function FabButton({ size, label, onClick, opacity = 1 }: { size: number; label: string; onClick: () => void; opacity?: number }) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      data-tap
      style={{
        flex: "none",
        width: size,
        height: size,
        borderRadius: 999,
        border: 0,
        background: "var(--primary)",
        color: "var(--surface)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 12px 30px rgba(90,65,255,.40)",
        opacity,
      }}
    >
      <Icon name="plus" size={28} strokeWidth={2.4} />
    </button>
  );
}

type CreateKind = "class" | "bundle" | "membership" | "pt" | "invite" | "tier";

const CREATE_OPTIONS: { kind: CreateKind; title: string; sub: string; icon: "calendar" | "ticket" | "gift" | "coaches" | "envelope" | "tag" }[] = [
  { kind: "class", title: "Group class", sub: "Repeats weekly · drop-in + monthly price", icon: "calendar" },
  { kind: "bundle", title: "Class bundle", sub: "A pack of sessions — 1 used per check-in", icon: "ticket" },
  { kind: "membership", title: "Membership", sub: "All classes for set months", icon: "gift" },
  { kind: "pt", title: "PT bundle", sub: "Private training sessions with a coach", icon: "coaches" },
  { kind: "invite", title: "Invite someone", sub: "Add a coach, head coach, front desk or accountant", icon: "envelope" },
  { kind: "tier", title: "Pay tier", sub: "What a coach earns per session and from PT sales", icon: "tag" },
];

/** The founder's FAB opens a "Create" menu, from any screen: what the gym
 * sells, plus inviting people and setting pay tiers, so nothing needs a trip
 * to another page first. Clients are registered by the front desk. */
function CreateFab({ size }: { size: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [kind, setKind] = useState<CreateKind | null>(null);
  const pick = (k: CreateKind) => {
    setMenuOpen(false);
    // Let the menu's close animation finish before the next sheet opens.
    window.setTimeout(() => setKind(k), 260);
  };
  return (
    <>
      <FabButton size={size} label="Create" onClick={() => setMenuOpen(true)} />
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>CREATE</div>
        <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>What are you adding?</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {CREATE_OPTIONS.map((o) => (
            <button
              key={o.kind}
              onClick={() => pick(o.kind)}
              data-sq
              style={{ textAlign: "left", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              <span style={{ width: 40, height: 40, flex: "none", borderRadius: 12, background: "var(--primary-tint)", color: "var(--primary-pressed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={o.icon} size={20} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", font: "700 16px var(--font-body)" }}>{o.title}</span>
                <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>{o.sub}</span>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </div>
        <Button variant="quiet" fullWidth style={{ marginTop: 12 }} onClick={() => setMenuOpen(false)}>
          Cancel
        </Button>
      </Sheet>
      <SeriesSheet open={kind === "class"} series={null} onClose={() => setKind(null)} />
      <PlanTypeSheet open={kind === "bundle" || kind === "membership"} kind={kind === "bundle" ? "bundle" : "membership"} planType={null} onClose={() => setKind(null)} />
      <BundleSheet open={kind === "pt"} bundleType={null} onClose={() => setKind(null)} />
      <InviteFlow open={kind === "invite"} onClose={() => setKind(null)} />
      <TierSheet open={kind === "tier"} tier={null} onClose={() => setKind(null)} />
    </>
  );
}

// The coach's FAB is a scanner. What was scanned decides what happens next:
// the coaches'-room QR -> the session stepper (locked to today); a member's
// PT code -> confirm deducting one session from that bundle.
export function ScanFlow({ trigger }: { trigger: (open: () => void, busy: boolean) => ReactNode }) {
  const { profile } = useAuth();
  const [scanning, setScanning] = useState(false);
  const [checking, setChecking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [attendance, setAttendance] = useState<{ token: string; date: string; month: string } | null>(null);
  const [pt, setPt] = useState<{ token: string; preview: PtScanPreview } | null>(null);

  const { data } = useAsync(() => (attendance ? api.month(attendance.month) : Promise.resolve(null)), [attendance?.month, profile?.id]);
  const rate = data?.rows.find((r) => r.coachId === profile?.id)?.rate ?? 0;

  const onScan = useCallback(async (token: string) => {
    setScanning(false);
    setChecking(true);
    try {
      const res = await api.scan(token);
      // Let the scanner's exit finish before the next sheet slides up.
      window.setTimeout(() => {
        if (res.kind === "attendance") setAttendance({ token, date: res.date, month: res.month });
        else setPt({ token, preview: res.package });
      }, 60);
    } catch (err) {
      setProblem(err instanceof Error ? err.message : "Couldn't read that code.");
    } finally {
      setChecking(false);
    }
  }, []);

  if (!profile) return null;

  return (
    <>
      {trigger(() => setScanning(true), checking)}
      {scanning && (
        <QrScanner
          title="Scan"
          hint="The coaches' room QR to log attendance, or a member's PT code to log their session."
          onClose={() => setScanning(false)}
          onScan={onScan}
        />
      )}
      <Sheet open={!!problem} onClose={() => setProblem(null)}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>SCAN</div>
        <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 12px" }}>That didn't work</div>
        <div role="alert" style={{ font: "600 14px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "12px 14px" }}>
          {problem}
        </div>
        <Button fullWidth size="lg" style={{ marginTop: 16 }} onClick={() => { setProblem(null); setScanning(true); }}>
          Scan again
        </Button>
        <Button fullWidth variant="secondary" style={{ marginTop: 8 }} onClick={() => setProblem(null)}>
          Close
        </Button>
      </Sheet>
      <AddSessionSheet
        open={!!attendance}
        onClose={() => setAttendance(null)}
        coachId={profile.id}
        month={attendance?.month ?? ""}
        rate={rate}
        scan={attendance ?? undefined}
      />
      <PtDeliverSheet scan={pt} onClose={() => setPt(null)} />
    </>
  );
}

function PtDeliverSheet({ scan, onClose }: { scan: { token: string; preview: PtScanPreview } | null; onClose: () => void }) {
  const open = !!scan;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);
  const p = scan?.preview;

  const confirm = async () => {
    if (!scan) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.deliverSession(scan.token);
      setLeft(res.package.sessionsRemaining);
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label={`Session logged · ${left ?? 0} left`} iconIn={iconIn} />
      ) : p ? (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>PRIVATE TRAINING</div>
          <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 4px" }}>{p.clientName}</div>
          <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)", marginBottom: 16 }}>
            {p.bundleName} · expires {p.expiryDate}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "14px 16px" }}>
            <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>SESSIONS LEFT</span>
            <span className="tabular" style={{ marginLeft: "auto", font: "800 26px var(--font-body)" }}>
              {p.sessionsRemaining} → {p.sessionsRemaining - 1}
            </span>
            <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>of {p.sessionsIncluded}</span>
          </div>
          {error && (
            <div role="alert" style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {error}
            </div>
          )}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={confirm}>
            {busy ? "Logging…" : "Deduct 1 session"}
          </Button>
          <Button fullWidth variant="secondary" style={{ marginTop: 8 }} disabled={busy} onClick={onClose}>
            Cancel
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}

type SoloAction = "new" | "dropin" | "checkin";

const SOLO_OPTIONS: { kind: SoloAction; title: string; sub: string; icon: "user-plus" | "ticket" | "check" }[] = [
  { kind: "new", title: "New client", sub: "Add someone and sell them a plan", icon: "user-plus" },
  { kind: "dropin", title: "Drop-in", sub: "One visit · cash or InstaPay", icon: "ticket" },
  { kind: "checkin", title: "Check in", sub: "Someone who didn't scan", icon: "check" },
];

/** The solo owner's FAB: her three everyday actions, from any screen. */
function SoloFab({ size }: { size: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [kind, setKind] = useState<SoloAction | null>(null);
  const pick = (k: SoloAction) => {
    setMenuOpen(false);
    // Let the menu's close animation finish before the next sheet opens.
    window.setTimeout(() => setKind(k), 260);
  };
  return (
    <>
      <FabButton size={size} label="Quick actions" onClick={() => setMenuOpen(true)} />
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>QUICK ACTIONS</div>
        <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>What do you need?</div>
        <div role="group" aria-label="Quick actions" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {SOLO_OPTIONS.map((o) => (
            <button
              key={o.kind}
              onClick={() => pick(o.kind)}
              data-sq
              style={{ textAlign: "left", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              <span style={{ width: 40, height: 40, flex: "none", borderRadius: 12, background: "var(--primary-tint)", color: "var(--primary-pressed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={o.icon} size={20} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", font: "700 16px var(--font-body)" }}>{o.title}</span>
                <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>{o.sub}</span>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </div>
        <Button variant="quiet" fullWidth style={{ marginTop: 12 }} onClick={() => setMenuOpen(false)}>
          Cancel
        </Button>
      </Sheet>
      <Sheet open={kind === "checkin"} onClose={() => setKind(null)}>
        <SheetHeading kicker="NO SCAN?" title="Check in" />
        <CheckInList />
      </Sheet>
      <Sheet open={kind === "dropin"} onClose={() => setKind(null)}>
        <SheetHeading kicker="DROP-IN" title="Drop-In" />
        {kind === "dropin" && <SoloDropIn onDone={() => setKind(null)} />}
      </Sheet>
      {kind === "new" && <NewClientModal onClose={() => setKind(null)} />}
    </>
  );
}

export function Fab({ size = 64 }: { size?: number }) {
  const { profile, orgMode } = useAuth();
  if (!profile) return null;
  if (isSoloOwner(profile.role, orgMode)) return <SoloFab size={size} />;
  if (profile.role === "dept_head") return <CreateFab size={size} />;
  return <ScanFlow trigger={(open, busy) => <FabButton size={size} label="Scan" onClick={open} opacity={busy ? 0.55 : 1} />} />;
}

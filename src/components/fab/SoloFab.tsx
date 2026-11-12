import { useRef, useState } from "react";
import { Icon } from "../Icon";
import { Sheet } from "../Sheet";
import { Button } from "../Button";
import { NewClientModal } from "../../routes/frontdesk/NewClientModal";
import { SoloDropIn } from "../../routes/frontdesk/SoloDropIn";
import { CheckInList } from "../../routes/frontdesk/CheckInList";
import { SheetHeading } from "../../routes/frontdesk/shared";
import { FabButton } from "./FabButton";
import { ScanFlow } from "./ScanFlow";

type SoloAction = "new" | "dropin" | "checkin" | "scan";

const SOLO_OPTIONS: { kind: SoloAction; title: string; sub: string; icon: "user-plus" | "ticket" | "check" | "qr-code" }[] = [
  { kind: "new", title: "New client", sub: "Add someone and sell them a plan", icon: "user-plus" },
  { kind: "dropin", title: "Drop-in", sub: "One visit · cash or InstaPay", icon: "ticket" },
  { kind: "checkin", title: "Check in", sub: "Someone who didn't scan", icon: "check" },
  { kind: "scan", title: "Scan PT code", sub: "Log a member's PT session", icon: "qr-code" },
];

/** The solo owner's FAB: her three everyday actions, from any screen. */
export function SoloFab({ size }: { size: number }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [kind, setKind] = useState<SoloAction | null>(null);
  // The scanner is opened from the menu, so ScanFlow hands its opener back here.
  const openScan = useRef<() => void>(() => {});
  const pick = (k: SoloAction) => {
    setMenuOpen(false);
    // Let the menu's close animation finish before the next sheet opens.
    window.setTimeout(() => (k === "scan" ? openScan.current() : setKind(k)), 260);
  };
  return (
    <>
      <FabButton size={size} label="Quick actions" onClick={() => setMenuOpen(true)} />
      <ScanFlow
        hint="A member's PT code, from their app, to log today's session."
        trigger={(open) => {
          openScan.current = open;
          return null;
        }}
      />
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="bq-label">QUICK ACTIONS</div>
        <div className="bq-title">What do you need?</div>
        <div role="group" aria-label="Quick actions" className="bq-stack">
          {SOLO_OPTIONS.map((o) => (
            <button
              key={o.kind}
              onClick={() => pick(o.kind)}
              style={{ textAlign: "left", background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}
            >
              <span style={{ width: 40, height: 40, flex: "none", borderRadius: 12, background: "var(--primary-tint)", color: "var(--primary-pressed)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={o.icon} size={20} />
              </span>
              <span className="bq-grow">
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

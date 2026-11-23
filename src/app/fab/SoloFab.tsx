import { useRef, useState } from "react";
import { Icon } from "../../design-system/components/Icon";
import { Sheet } from "../../design-system/components/Sheet";
import { Button } from "../../design-system/components/Button";
import { FabButton } from "./FabButton";
import { ScanFlow } from "../../shared/components/ScanFlow";
import { CheckInList, NewClientModal, SheetHeading, SoloDropIn } from "../../features/frontdesk";
import "./SoloFab.css";

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
            <button className="bq-solo-fab-btn"
              key={o.kind}
              onClick={() => pick(o.kind)}
            >
              <span className="bq-solo-fab-row">
                <Icon name={o.icon} size={20} />
              </span>
              <span className="bq-grow">
                <span className="bq-solo-fab-title">{o.title}</span>
                <span className="bq-solo-fab-meta">{o.sub}</span>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </div>
        <Button className="bq-mt-3" variant="quiet" fullWidth onClick={() => setMenuOpen(false)}>
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

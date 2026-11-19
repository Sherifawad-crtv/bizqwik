import { useState } from "react";
import { Icon } from "../../design-system/components/Icon";
import { Sheet } from "../../design-system/components/Sheet";
import { Button } from "../../design-system/components/Button";
import { SeriesSheet } from "../../shared/components/SeriesSheet";
import { PlanTypeSheet } from "../../features/catalog/Plans";
import { BundleSheet } from "../../features/catalog/BundlesPanel";
import { InviteFlow } from "../../shared/components/InviteFlow";
import { TierSheet } from "../../features/manage/TiersPanel";
import { FabButton } from "./FabButton";
import "./CreateFab.css";

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
export function CreateFab({ size }: { size: number }) {
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
        <div className="bq-label">CREATE</div>
        <div className="bq-title">What are you adding?</div>
        <div className="bq-stack">
          {CREATE_OPTIONS.map((o) => (
            <button className="bq-create-fab-btn"
              key={o.kind}
              onClick={() => pick(o.kind)}
            >
              <span className="bq-create-fab-row">
                <Icon name={o.icon} size={20} />
              </span>
              <span className="bq-grow">
                <span className="bq-create-fab-title">{o.title}</span>
                <span className="bq-create-fab-meta">{o.sub}</span>
              </span>
              <Icon name="chevron-right" size={18} />
            </button>
          ))}
        </div>
        <Button className="bq-mt-3" variant="quiet" fullWidth onClick={() => setMenuOpen(false)}>
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

import { useState } from "react";
import { Icon } from "../Icon";
import { Sheet } from "../Sheet";
import { Button } from "../Button";
import { SeriesSheet } from "../../routes/catalog/Classes";
import { PlanTypeSheet } from "../../routes/catalog/Plans";
import { BundleSheet } from "../../routes/manage/BundlesPanel";
import { InviteFlow } from "../../routes/manage/Invites";
import { TierSheet } from "../../routes/manage/TiersPanel";
import { FabButton } from "./FabButton";

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
      <SeriesSheet open={kind === "class"} series={null} onClose={() => setKind(null)} />
      <PlanTypeSheet open={kind === "bundle" || kind === "membership"} kind={kind === "bundle" ? "bundle" : "membership"} planType={null} onClose={() => setKind(null)} />
      <BundleSheet open={kind === "pt"} bundleType={null} onClose={() => setKind(null)} />
      <InviteFlow open={kind === "invite"} onClose={() => setKind(null)} />
      <TierSheet open={kind === "tier"} tier={null} onClose={() => setKind(null)} />
    </>
  );
}

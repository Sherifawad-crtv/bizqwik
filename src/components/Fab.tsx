import { useCallback, useState } from "react";
import { Icon } from "./Icon";
import { AddSessionSheet } from "./AddSessionSheet";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { SeriesSheet, PlanTypeSheet } from "../routes/Catalog";
import { BundleSheet } from "../routes/Manage";
import { useAuth } from "../lib/auth";
import { useOwnMonth } from "../lib/ownMonth";
import { useAsync } from "../lib/useAsync";
import { api } from "../lib/backend";
import { monthLabel } from "../lib/format";

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

type CreateKind = "class" | "bundle" | "membership" | "pt";

const CREATE_OPTIONS: { kind: CreateKind; title: string; sub: string; icon: "calendar" | "ticket" | "gift" | "coaches" }[] = [
  { kind: "class", title: "Group class", sub: "Repeats weekly · drop-in + monthly price", icon: "calendar" },
  { kind: "bundle", title: "Class bundle", sub: "A pack of class credits, any class", icon: "ticket" },
  { kind: "membership", title: "Membership", sub: "All classes for set months", icon: "gift" },
  { kind: "pt", title: "PT bundle", sub: "Private training sessions with a coach", icon: "coaches" },
];

/** The founder's FAB opens a "Create" menu for what the gym sells. Clients
 * are registered by the front desk, not here. */
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
    </>
  );
}

function AddSessionFab({ size }: { size: number }) {
  const { profile } = useAuth();
  const { month } = useOwnMonth();
  const [open, setOpen] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const { data } = useAsync(() => api.month(month), [month, profile?.id]);
  const own = data?.rows.find((r) => r.coachId === profile?.id);
  const enabled = own ? own.state === "logging" : true;

  const showHint = useCallback(() => {
    setHint(`${monthLabel(month)} is closed — switch to the current month to add sessions.`);
    window.setTimeout(() => setHint(null), 2600);
  }, [month]);

  if (!profile) return null;

  return (
    <>
      {hint && (
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: size + 14,
            zIndex: 60,
            maxWidth: 240,
            background: "var(--ink)",
            color: "var(--surface)",
            font: "600 13px/1.4 var(--font-body)",
            padding: "10px 14px",
            borderRadius: 14,
            boxShadow: "var(--shadow-float)",
          }}
        >
          {hint}
        </div>
      )}
      <FabButton size={size} label="Log session" onClick={() => (enabled ? setOpen(true) : showHint())} opacity={enabled ? 1 : 0.55} />
      <AddSessionSheet open={open} onClose={() => setOpen(false)} coachId={profile.id} month={month} rate={own?.rate ?? 0} />
    </>
  );
}

export function Fab({ size = 64 }: { size?: number }) {
  const { profile } = useAuth();
  if (!profile) return null;
  if (profile.role === "dept_head") return <CreateFab size={size} />;
  return <AddSessionFab size={size} />;
}

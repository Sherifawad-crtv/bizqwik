import { useCallback, useState } from "react";
import { Icon } from "./Icon";
import { AddSessionSheet } from "./AddSessionSheet";
import { NewClientWizardSheet } from "./NewClientWizardSheet";
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

/** Dept heads' FAB starts the client-onboarding flow instead of logging a
 * group session — creating clients and selling them a package is their
 * primary fast-path action now, not personal session logging. */
function NewClientFab({ size }: { size: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <FabButton size={size} label="New client" onClick={() => setOpen(true)} />
      <NewClientWizardSheet open={open} onClose={() => setOpen(false)} />
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
  if (profile.role === "dept_head") return <NewClientFab size={size} />;
  return <AddSessionFab size={size} />;
}

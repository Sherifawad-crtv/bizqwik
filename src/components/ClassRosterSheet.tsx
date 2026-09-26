import { EmptyState } from "./EmptyState";
import { useState } from "react";
import { api } from "../lib/backend";
import { useAsync } from "../lib/useAsync";
import { egp } from "../lib/format";
import type { ClassBooking, PayMethod, BookingAttendance } from "../lib/types";
import { Sheet } from "./Sheet";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

const ATT_LABEL: Record<BookingAttendance, string> = {
  booked: "Booked",
  arrived: "Arrived",
  no_show: "No-show",
  cancelled: "Cancelled",
};
const ATT_TONE: Record<BookingAttendance, { fg: string; bg: string }> = {
  booked: { fg: "var(--ink-muted)", bg: "var(--sunken)" },
  arrived: { fg: "var(--paid-fg)", bg: "var(--paid-bg)" },
  no_show: { fg: "var(--danger-fg)", bg: "var(--danger-bg)" },
  cancelled: { fg: "var(--ink-faint)", bg: "var(--sunken)" },
};

/** Staff roster for one class: mark arrived / no-show and collect a pay-at-desk
 * booking (cash / card / wallet). Used by dept_head (class management) and the
 * front desk. `onChanged` lets the opener refresh its own counts. */
export function ClassRosterSheet({
  open,
  onClose,
  classId,
  title,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  classId: string | null;
  title: string;
  onChanged?: () => void;
}) {
  const roster = useAsync(() => (classId ? api.classBookings(classId) : Promise.resolve({ bookings: [] })), [classId]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [collectId, setCollectId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bookings = roster.data?.bookings ?? [];
  const live = bookings.filter((b) => b.attendance !== "cancelled");

  const run = async (fn: () => Promise<unknown>, id: string) => {
    setError(null);
    setBusyId(id);
    try {
      await fn();
      setCollectId(null);
      roster.refetch();
      onChanged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Sheet open={open} onClose={busyId ? () => {} : onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>CLASS ROSTER</div>
      <div style={{ font: "800 24px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 4px" }}>{title}</div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginBottom: 16 }}>
        {live.length} booked{live.length > 0 ? ` · ${live.filter((b) => b.coverage === "plan").length} on a plan · ${live.filter((b) => b.attendance === "arrived").length} arrived` : ""}
      </div>

      {roster.loading && <Spinner />}
      {error && (
        <div style={{ marginBottom: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>
      )}
      {!roster.loading && live.length === 0 && (
        <EmptyState bare icon="clients" title="No one has booked this class yet" body="Members book from the app, or the front desk can add a drop-in from Drop-In → Class session." />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {live.map((b) => (
          <RosterRow key={b.id} b={b} busy={busyId === b.id} collecting={collectId === b.id} onSetCollecting={(on) => setCollectId(on ? b.id : null)} run={run} />
        ))}
      </div>

      <Button variant="quiet" fullWidth style={{ marginTop: 16 }} disabled={!!busyId} onClick={onClose}>
        Close
      </Button>
    </Sheet>
  );
}

function RosterRow({
  b,
  busy,
  collecting,
  onSetCollecting,
  run,
}: {
  b: ClassBooking;
  busy: boolean;
  collecting: boolean;
  onSetCollecting: (on: boolean) => void;
  run: (fn: () => Promise<unknown>, id: string) => void;
}) {
  const tone = ATT_TONE[b.attendance];
  const paid = b.payStatus === "paid";
  const onPlan = b.coverage === "plan";
  return (
    <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 14px", opacity: busy ? 0.6 : 1 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.clientName ?? "Member"}</div>
          <div style={{ font: "500 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>
            {onPlan ? "On their plan" : `Drop-in · ${b.price > 0 ? egp(b.price) : "Free"} · ${paid ? "Paid" : "Unpaid"}`}
          </div>
        </div>
        <span style={{ flex: "none", font: "700 10px var(--font-mono)", letterSpacing: ".06em", color: tone.fg, background: tone.bg, borderRadius: 8, padding: "5px 8px" }}>
          {ATT_LABEL[b.attendance].toUpperCase()}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <RowBtn active={b.attendance === "arrived"} disabled={busy} onClick={() => run(() => api.markAttendance(b.id, "arrived"), b.id)}>Arrived</RowBtn>
        <RowBtn active={b.attendance === "no_show"} disabled={busy} onClick={() => run(() => api.markAttendance(b.id, "no_show"), b.id)}>No-show</RowBtn>
        {!paid && !collecting && (
          <RowBtn primary disabled={busy} onClick={() => onSetCollecting(true)}>Collect</RowBtn>
        )}
      </div>

      {!paid && collecting && (
        <div style={{ marginTop: 10 }}>
          <div style={{ font: "700 10px var(--font-mono)", letterSpacing: ".06em", color: "var(--ink-faint)", marginBottom: 6 }}>COLLECT PAYMENT</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(["cash", "card", "wallet"] as PayMethod[]).map((pm) => (
              <RowBtn key={pm} disabled={busy} onClick={() => run(() => api.collectBooking(b.id, pm), b.id)}>
                {pm[0].toUpperCase() + pm.slice(1)}
              </RowBtn>
            ))}
            <RowBtn disabled={busy} onClick={() => onSetCollecting(false)}>Cancel</RowBtn>
          </div>
        </div>
      )}
    </div>
  );
}

function RowBtn({ children, onClick, disabled, active, primary }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; active?: boolean; primary?: boolean }) {
  return (
    <button
      type="button"
      data-sq
      disabled={disabled}
      onClick={onClick}
      style={{
        flex: "1 1 0",
        border: active || primary ? 0 : "1px solid var(--line)",
        background: primary ? "var(--primary)" : active ? "var(--primary-tint-strong)" : "var(--surface)",
        color: primary ? "var(--surface)" : active ? "var(--primary-pressed)" : "var(--ink-muted)",
        borderRadius: 10,
        padding: "8px 4px",
        font: "700 13px var(--font-body)",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

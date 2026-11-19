import { cx } from "../../design-system/cx";
import { EmptyState } from "../../design-system/components/EmptyState";
import { useState } from "react";
import { api } from "../api/backend";
import { useAsync } from "../api/useAsync";
import { useAuth } from "../auth";
import { isSoloOwner } from "../screen/nav";
import { egp } from "../format";
import { PAY_METHOD_LABELS, type ClassBooking, type PayMethod, type BookingAttendance } from "../types";
import { Sheet } from "../../design-system/components/Sheet";
import { Button } from "../../design-system/components/Button";
import { InlineSpinner } from "../../design-system/components/Spinner";
import { Tag, type Tone } from "../../design-system/components/Tag";
import "./ClassRosterSheet.css";

const ATT_LABEL: Record<BookingAttendance, string> = {
  booked: "Booked",
  arrived: "Arrived",
  no_show: "No-show",
  cancelled: "Cancelled",
};
const ATT_TONE: Record<BookingAttendance, Tone> = { booked: "neutral", arrived: "paid", no_show: "danger", cancelled: "neutral" };

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
      <div className="bq-label">CLASS ROSTER</div>
      <div className="bq-class-roster-sheet-title">{title}</div>
      <div className="bq-class-roster-sheet-meta">
        {live.length} booked{live.length > 0 ? ` · ${live.filter((b) => b.coverage === "plan").length} on a plan · ${live.filter((b) => b.attendance === "arrived").length} arrived` : ""}
      </div>

      {roster.loading && <InlineSpinner />}
      {error && (
        <div className="bq-rise bq-class-roster-sheet-text">{error}</div>
      )}
      {!roster.loading && live.length === 0 && (
        <EmptyState bare icon="clients" title="No one has booked this class yet" body="Members book from the app, or the front desk can add a drop-in from Drop-In → Class session." />
      )}

      <div className="bq-stack">
        {live.map((b) => (
          <RosterRow key={b.id} b={b} busy={busyId === b.id} collecting={collectId === b.id} onSetCollecting={(on) => setCollectId(on ? b.id : null)} run={run} />
        ))}
      </div>

      <Button className="bq-mt-4" variant="quiet" fullWidth disabled={!!busyId} onClick={onClose}>
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
  const { profile, orgMode } = useAuth();
  // A solo business takes cash or InstaPay only.
  const solo = !!profile && isSoloOwner(profile.role, orgMode);
  const paid = b.payStatus === "paid";
  const onPlan = b.coverage === "plan";
  return (
    <div className="bq-class-roster-sheet-roster-row-box" style={{ opacity: busy ? 0.6 : 1 }}>
      <div className="bq-flex bq-items-center bq-gap-2">
        <div className="bq-grow">
          <div className="bq-class-roster-sheet-roster-row-title">{b.clientName ?? "Member"}</div>
          <div className="bq-class-roster-sheet-roster-row-meta">
            {onPlan ? "On their plan" : `Drop-in · ${b.price > 0 ? egp(b.price) : "Free"} · ${paid ? "Paid" : "Unpaid"}`}
          </div>
        </div>
        <Tag tone={tone}>
          {ATT_LABEL[b.attendance].toUpperCase()}
        </Tag>
      </div>

      <div className="bq-flex bq-gap-2 bq-mt-2">
        <RowBtn active={b.attendance === "arrived"} disabled={busy} onClick={() => run(() => api.markAttendance(b.id, "arrived"), b.id)}>Arrived</RowBtn>
        <RowBtn active={b.attendance === "no_show"} disabled={busy} onClick={() => run(() => api.markAttendance(b.id, "no_show"), b.id)}>No-show</RowBtn>
        {!paid && !collecting && (
          <RowBtn primary disabled={busy} onClick={() => onSetCollecting(true)}>Collect</RowBtn>
        )}
      </div>

      {!paid && collecting && (
        <div className="bq-mt-2">
          <div className="bq-class-roster-sheet-roster-row-label">COLLECT PAYMENT</div>
          <div className="bq-flex bq-gap-2">
            {((solo ? ["cash", "instapay"] : ["cash", "card", "instapay", "wallet"]) as PayMethod[]).map((pm) => (
              <RowBtn key={pm} disabled={busy} onClick={() => run(() => api.collectBooking(b.id, pm), b.id)}>
                {PAY_METHOD_LABELS[pm]}
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
      disabled={disabled}
      onClick={onClick}
      className={cx("bq-roster-choice", primary ? "bq-roster-choice--primary" : active && "bq-roster-choice--active")}
    >
      {children}
    </button>
  );
}

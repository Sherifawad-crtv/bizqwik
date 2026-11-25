import { EmptyState } from "../../../design-system/components/EmptyState";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { splitSessions } from "../domain/sessions";
import { cancelSession, useSessions } from "./hooks/useSessions";
import { useSetHeader } from "../../../shared/screen/header";
import { egp } from "../../../shared/format";
import type { GymClass } from "../../../shared/types";
import { InlineSpinner } from "../../../design-system/components/Spinner";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { ConfirmSheet } from "../../../design-system/components/ConfirmSheet";
import { ClassRosterSheet } from "../../../shared/classes/ClassRosterSheet";
import { whenLabel } from "../../../shared/classes/classTime";
import { SeriesSheet } from "../../../shared/classes/SeriesSheet";
import { useNow } from "../../../shared/hooks/useNow";
import { type FormState, emptyForm, formOf } from "../../../shared/classes/classForm";
import { ClassSheet } from "../../../shared/classes/ClassSheet";
import { useBackAction } from "../../../shared/screen/floatingActions";
import { useIsMobile } from "../../../design-system/hooks/useIsMobile";
import "./ClassesManage.css";

export function ClassesManage() {
  const navigate = useNavigate();
  const classes = useSessions();
  const [form, setForm] = useState<FormState | null>(null);
  const [newClass, setNewClass] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState<GymClass | null>(null);
  const [roster, setRoster] = useState<GymClass | null>(null);
  useSetHeader({ kicker: "CATALOG", title: "Sessions" }, []);
  useBackAction(() => navigate("/catalog"));
  const isMobile = useIsMobile();
  const now = useNow();

  // Sessions come from the recurring classes (Catalog → Classes). This screen
  // is the day-to-day view: who's booked, rosters, and one-off changes.
  const list = classes.data?.classes ?? [];
  const { scheduled, past, cancelled } = splitSessions(list, now);

  return (
    <div>
      {!isMobile && (
      <button className="bq-classes-manage-btn"
        onClick={() => navigate("/catalog")}
      >
        <Icon name="chevron-left" size={16} /> Catalog
      </button>
      )}

      <div className="bq-flex bq-items-center bq-gap-3 bq-mb-4">
        <div className="bq-grow">
          <div className="bq-classes-manage-title">Sessions</div>
          <div className="bq-classes-manage-meta">
            Upcoming sessions from your classes. Tap one to edit just that session.
          </div>
        </div>
        <Button className="bq-flex-none" variant="secondary" onClick={() => setForm(emptyForm())}>
          <Icon name="plus" size={18} /> One-off
        </Button>
      </div>

      {classes.loading && <InlineSpinner />}
      {classes.error && (
        <div  className="bq-error bq-rise">{classes.error}</div>
      )}

      {!classes.loading && list.length === 0 && (
        <EmptyState icon="calendar" title="No sessions yet" body="Sessions come from your recurring classes. Add a class and its upcoming sessions appear here." action={{ label: "+ New class", onClick: () => setNewClass(true) }} />
      )}

      {scheduled.length > 0 && (
        <div className="bq-stack">
          {scheduled.map((c) => (
            <ClassCard key={c.id} c={c} onEdit={() => setForm(formOf(c))} onRoster={() => setRoster(c)} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <div className="bq-classes-manage-label">
            LAST 2 WEEKS · {past.length}
          </div>
          <div className="bq-stack">
            {past.map((c) => (
              <ClassCard key={c.id} c={c} onRoster={() => setRoster(c)} />
            ))}
          </div>
        </>
      )}

      {cancelled.length > 0 && (
        <>
          <div className="bq-classes-manage-label">
            CANCELLED · {cancelled.length}
          </div>
          <div className="bq-stack">
            {cancelled.map((c) => (
              <ClassCard key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      <ClassSheet
        form={form}
        onClose={() => setForm(null)}
        onSaved={() => {
          setForm(null);
          classes.refetch();
        }}
        onRequestCancel={(c) => {
          setForm(null);
          setConfirmCancel(c);
        }}
      />

      <SeriesSheet open={newClass} series={null} onClose={() => { setNewClass(false); classes.refetch(); }} />
      <ClassRosterSheet
        open={roster !== null}
        onClose={() => setRoster(null)}
        classId={roster?.id ?? null}
        title={roster?.title ?? "Class"}
      />

      <ConfirmSheet
        open={confirmCancel !== null}
        onClose={() => setConfirmCancel(null)}
        kicker="MEMBER APP"
        title={`Cancel ${confirmCancel?.title ?? "class"}?`}
        sub="Members who paid from their wallet are refunded to wallet, and class-bundle credits are returned automatically. This can't be undone."
        confirmLabel="Cancel class"
        danger
        onConfirm={async () => {
          if (confirmCancel) await cancelSession(confirmCancel.id);
          setConfirmCancel(null);
          classes.refetch();
        }}
      />
    </div>
  );
}

function ClassCard({ c, onEdit, onRoster }: { c: GymClass; onEdit?: () => void; onRoster?: () => void }) {
  const cancelled = c.status === "cancelled";
  return (
    <div
      className="bq-card bq-card--sm" style={{ opacity: cancelled ? 0.55 : 1 }}
    >
      <div className="bq-flex bq-items-center bq-gap-3" onClick={onEdit} style={{ cursor: onEdit ? "pointer" : "default" }}>
        <div className="bq-grow">
          <div className="bq-classes-manage-class-card-title" style={{ textDecoration: cancelled ? "line-through" : "none" }}>{c.title}</div>
          <div className="bq-classes-manage-class-card-meta">{whenLabel(c.startsAt)}</div>
          {!cancelled && (c.bookedCount ?? 0) > 0 && (
            <div className="bq-classes-manage-class-card-meta-2">
              {c.bookedCount} booked · {c.planSeats ?? 0} on a plan · {c.dropInSeats ?? 0} drop-in
            </div>
          )}
          {c.description && (
            <div className="bq-classes-manage-class-card-text">
              {c.description}
            </div>
          )}
        </div>
        <div className="bq-flex-none bq-text-right">
          <div className="tabular bq-classes-manage-class-card-title-2">{c.price > 0 ? egp(c.price) : "Free"}</div>
          <div className="bq-classes-manage-class-card-label">DROP-IN</div>
          {onEdit && <div className="bq-classes-manage-class-card-label-2">EDIT</div>}
        </div>
      </div>
      {onRoster && (
        <button className="bq-classes-manage-class-card-btn"
          type="button"
          onClick={onRoster}
        >
          View roster
        </button>
      )}
    </div>
  );
}

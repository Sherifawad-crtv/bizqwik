import { EmptyState } from "../../design-system/components/EmptyState";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/backend";
import { useAsync } from "../../shared/api/useAsync";
import { useSetHeader } from "../../shared/screen/header";
import { egp } from "../../shared/format";
import type { GymClass } from "../../shared/types";
import { InlineSpinner } from "../../design-system/components/Spinner";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { ConfirmSheet } from "../../design-system/components/ConfirmSheet";
import { ClassRosterSheet } from "../../shared/components/ClassRosterSheet";
import { whenLabel } from "../../shared/classTime";
import { SeriesSheet } from "../../shared/components/SeriesSheet";
import { useNow } from "../../shared/useNow";
import { type FormState, emptyForm, formOf } from "../../shared/classForm";
import { ClassSheet } from "../../shared/components/ClassSheet";
import { useBackAction } from "../../shared/screen/floatingActions";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";

export function ClassesManage() {
  const navigate = useNavigate();
  const classes = useAsync(() => api.classes(), []);
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
  const cutoff = now - 3 * 60 * 60 * 1000;
  const scheduled = list.filter((c) => c.status === "active" && Date.parse(c.startsAt) >= cutoff);
  const past = list.filter((c) => c.status === "active" && Date.parse(c.startsAt) < cutoff).reverse();
  const cancelled = list.filter((c) => c.status === "cancelled");

  return (
    <div>
      {!isMobile && (
      <button
        onClick={() => navigate("/catalog")}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "none", color: "var(--color-text-secondary-default)", cursor: "pointer", font: "700 var(--text-subheadline-size) var(--font-family-body)", marginBottom: 14, padding: 0 }}
      >
        <Icon name="chevron-left" size={16} /> Catalog
      </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div className="bq-grow">
          <div style={{ font: "800 var(--text-title-1-size)/1.1 var(--font-family-body)", letterSpacing: "-.02em" }}>Sessions</div>
          <div style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)", marginTop: 4 }}>
            Upcoming sessions from your classes. Tap one to edit just that session.
          </div>
        </div>
        <Button variant="secondary" onClick={() => setForm(emptyForm())} style={{ flex: "none" }}>
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
          <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)", margin: "24px 2px 10px" }}>
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
          <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)", margin: "24px 2px 10px" }}>
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
          if (confirmCancel) await api.cancelClass(confirmCancel.id);
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
      <div onClick={onEdit} style={{ display: "flex", alignItems: "center", gap: 12, cursor: onEdit ? "pointer" : "default" }}>
        <div className="bq-grow">
          <div style={{ font: "700 var(--text-callout-size) var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: cancelled ? "line-through" : "none" }}>{c.title}</div>
          <div style={{ font: "500 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)", marginTop: 3 }}>{whenLabel(c.startsAt)}</div>
          {!cancelled && (c.bookedCount ?? 0) > 0 && (
            <div style={{ font: "500 var(--text-caption-1-size) var(--font-family-mono)", color: "var(--color-text-tertiary-default)", marginTop: 3 }}>
              {c.bookedCount} booked · {c.planSeats ?? 0} on a plan · {c.dropInSeats ?? 0} drop-in
            </div>
          )}
          {c.description && (
            <div style={{ font: "400 var(--text-footnote-size)/1.4 var(--font-family-body)", color: "var(--color-text-tertiary-default)", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {c.description}
            </div>
          )}
        </div>
        <div style={{ flex: "none", textAlign: "right" }}>
          <div className="tabular" style={{ font: "800 var(--text-callout-size) var(--font-family-body)" }}>{c.price > 0 ? egp(c.price) : "Free"}</div>
          <div style={{ font: "600 10px var(--font-family-mono)", letterSpacing: ".06em", color: "var(--color-text-tertiary-default)" }}>DROP-IN</div>
          {onEdit && <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".06em", color: "var(--color-text-tertiary-default)", marginTop: 4 }}>EDIT</div>}
        </div>
      </div>
      {onRoster && (
        <button
          type="button"
          onClick={onRoster}
          style={{ marginTop: 12, width: "100%", border: "1px solid var(--color-border-primary-default)", background: "var(--color-bg-canvas-default)", color: "var(--color-text-secondary-default)", borderRadius: "var(--radius-button)", padding: "8px 0", font: "700 var(--text-footnote-size) var(--font-family-body)", cursor: "pointer" }}
        >
          View roster
        </button>
      )}
    </div>
  );
}

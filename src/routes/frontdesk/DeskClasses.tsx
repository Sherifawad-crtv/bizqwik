import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/backend";
import { useAsync } from "../../lib/useAsync";
import { useSetHeader } from "../../lib/header";
import { egp } from "../../lib/format";
import type { GymClass } from "../../lib/types";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/Icon";
import { ClassRosterSheet } from "../../components/ClassRosterSheet";

const pad = (n: number) => String(n).padStart(2, "0");
function whenLabel(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  const h = d.getHours();
  const am = h < 12;
  const h12 = ((h + 11) % 12) + 1;
  return `${date} · ${h12}:${pad(d.getMinutes())} ${am ? "AM" : "PM"}`;
}

/** Front-desk view of upcoming classes → open a roster to mark attendance and
 * collect pay-at-desk. dept_head manages the classes themselves elsewhere. */
export function DeskClasses() {
  const navigate = useNavigate();
  const classes = useAsync(() => api.classes(), []);
  const [roster, setRoster] = useState<GymClass | null>(null);
  useSetHeader({ kicker: "FRONT DESK", title: "Classes" }, []);

  const now = Date.now();
  const upcoming = (classes.data?.classes ?? [])
    .filter((c) => c.status === "active" && Date.parse(c.startsAt) >= now - 6 * 60 * 60 * 1000)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  return (
    <div>
      <button
        onClick={() => navigate("/")}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "none", color: "var(--ink-muted)", cursor: "pointer", font: "700 14px var(--font-body)", marginBottom: 14, padding: 0 }}
      >
        <Icon name="chevron-left" size={16} /> Front Desk
      </button>

      <div style={{ font: "800 26px/1.1 var(--font-body)", letterSpacing: "-.02em", marginBottom: 4 }}>Classes</div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginBottom: 16 }}>
        Open a class to mark arrivals and collect payment.
      </div>

      {classes.loading && <Spinner />}
      {classes.error && (
        <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{classes.error}</div>
      )}
      {!classes.loading && upcoming.length === 0 && (
        <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "34px 20px", textAlign: "center", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>
          No upcoming classes.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {upcoming.map((c) => (
          <button
            key={c.id}
            type="button"
            data-sq
            onClick={() => setRoster(c)}
            style={{ textAlign: "left", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "14px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
              <div style={{ font: "500 13px var(--font-mono)", color: "var(--ink-muted)", marginTop: 3 }}>{whenLabel(c.startsAt)}</div>
            </div>
            <span className="tabular" style={{ flex: "none", font: "800 15px var(--font-body)" }}>{c.price > 0 ? egp(c.price) : "Free"}</span>
            <span style={{ flex: "none", color: "var(--ink-faint)", display: "flex" }}><Icon name="chevron-right" size={20} /></span>
          </button>
        ))}
      </div>

      <ClassRosterSheet open={roster !== null} onClose={() => setRoster(null)} classId={roster?.id ?? null} title={roster?.title ?? "Class"} />
    </div>
  );
}

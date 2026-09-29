import { useNavigate } from "react-router-dom";
import { useSetHeader } from "../../lib/header";
import { Icon } from "../../components/Icon";
import { ClassCalendar } from "./ClassCalendar";

/** Front-desk view of the class schedule as a calendar (day, week or month).
 * Open a class to mark arrivals and collect pay-at-desk; the department head
 * manages the classes themselves elsewhere. */
export function DeskClasses({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  useSetHeader(embedded ? null : { kicker: "FRONT DESK", title: "Classes" }, []);

  return (
    <div>
      {!embedded && (
        <>
          <button
            onClick={() => navigate("/")}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "none", color: "var(--ink-muted)", cursor: "pointer", font: "700 14px var(--font-body)", marginBottom: 14, padding: 0 }}
          >
            <Icon name="chevron-left" size={16} /> Front Desk
          </button>
          <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginBottom: 16 }}>Open a class to mark arrivals and collect payment.</div>
        </>
      )}
      <ClassCalendar />
    </div>
  );
}

import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Button } from "./Button";

/** The one empty state used everywhere: what's missing, why/what to do next,
 * and (when the viewer can fix it) a button that does it. `bare` drops the
 * card chrome for use inside a sheet or an existing card. */
export function EmptyState({
  icon = "inbox",
  title,
  body,
  action,
  bare = false,
  testId,
}: {
  icon?: IconName;
  title: string;
  body?: ReactNode;
  action?: { label: string; onClick: () => void };
  bare?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-sq={bare ? undefined : true}
      data-testid={testId ?? "empty-state"}
      style={{
        background: bare ? "transparent" : "var(--surface)",
        border: bare ? 0 : "1px solid var(--line)",
        borderRadius: "var(--r-tile)",
        padding: bare ? "18px 8px" : "28px 20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 6,
      }}
    >
      <span style={{ width: 44, height: 44, borderRadius: 14, background: "var(--primary-tint)", color: "var(--primary-pressed)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 4 }}>
        <Icon name={icon} size={22} />
      </span>
      <div style={{ font: "700 16px/1.3 var(--font-body)", color: "var(--ink)" }}>{title}</div>
      {body && <div style={{ font: "500 13px/1.5 var(--font-body)", color: "var(--ink-muted)", maxWidth: 340 }}>{body}</div>}
      {action && (
        <Button variant="secondary" style={{ marginTop: 8 }} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

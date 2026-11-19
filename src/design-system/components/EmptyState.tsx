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
    <div className="bq-empty-state-stack"

      data-testid={testId ?? "empty-state"}
      style={{ background: bare ? "transparent" : "var(--color-bg-surface-primary-default)", padding: bare ? "18px 8px" : "28px 20px" }}
    >
      <span className="bq-empty-state-row">
        <Icon name={icon} size={22} />
      </span>
      <div className="bq-empty-state-title">{title}</div>
      {body && <div className="bq-empty-state-text">{body}</div>}
      {action && (
        <Button className="bq-mt-2" variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

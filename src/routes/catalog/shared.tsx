import { EmptyState } from "../../components/EmptyState";

export function PanelHeader({ title, count, action }: { title: string; count: number; action?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span className="bq-h2">{title}</span>
      <span className="bq-meta">{count}</span>
      {action && <div style={{ marginLeft: "auto" }}>{action}</div>}
    </div>
  );
}

export function EmptyRow({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  const [title, ...rest] = text.split(". ");
  return <EmptyState bare icon="tag" title={title.replace(/\.$/, "")} body={rest.join(". ") || undefined} action={action} />;
}

// ---------- Classes (recurring series) ----------

import { EmptyState } from "../../components/EmptyState";


export function EmptyRow({ text, action }: { text: string; action?: { label: string; onClick: () => void } }) {
  const [title, ...rest] = text.split(". ");
  return <EmptyState bare icon="tag" title={title.replace(/\.$/, "")} body={rest.join(". ") || undefined} action={action} />;
}

// ---------- Classes (recurring series) ----------

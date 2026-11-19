import { cx } from "../../design-system/cx";
import { EmptyState } from "../../design-system/components/EmptyState";
import { useSticky } from "../../design-system/hooks/useSticky";
import { api } from "../api/backend";
import { useAsync } from "../api/useAsync";
import { egp } from "../format";
import type { ActivityEntry } from "../types";
import { InlineSpinner } from "../../design-system/components/Spinner";
import { Segmented } from "../../design-system/components/Segmented";
import { Tag, type Tone } from "../../design-system/components/Tag";
import "./ActivityPanel.css";

export type Cat = "sale" | "refund" | "wallet" | "points" | "class" | "checkin" | "other";

function catOf(type: string): Cat {
  if (type.startsWith("sale_") || type === "class_collected") return "sale";
  if (type === "refund_desk" || type === "wallet_refund") return "refund";
  if (type.startsWith("wallet_")) return "wallet";
  if (type.startsWith("points")) return "points";
  if (type.startsWith("class")) return "class";
  if (type === "booking_arrived" || type === "booking_no_show") return "class";
  if (type === "check_in") return "checkin";
  return "other";
}

const CAT_TONE: Record<Cat, { tone: Tone; label: string }> = {
  sale: { tone: "paid", label: "SALE" },
  refund: { tone: "danger", label: "REFUND" },
  wallet: { tone: "primary", label: "WALLET" },
  points: { tone: "settled", label: "POINTS" },
  class: { tone: "logging", label: "CLASS" },
  checkin: { tone: "neutral", label: "CHECK-IN" },
  other: { tone: "neutral", label: "EVENT" },
};

function metaStr(m: Record<string, unknown> | null, key: string): string | null {
  const v = m?.[key];
  return typeof v === "string" ? v : null;
}

/** A friendly sentence for the feed. `who` is the client's name or a fallback. */
function describe(e: ActivityEntry): string {
  const who = e.clientName ?? "A member";
  const title = metaStr(e.meta, "title");
  switch (e.type) {
    case "check_in":
      return `${who} checked in`;
    case "class_booked":
      if (metaStr(e.meta, "coverage") === "plan") return `${who} booked ${title ?? "a class"} on their plan`;
      return `${who} booked ${title ?? "a class"}${metaStr(e.meta, "payMethod") === "wallet" ? " (paid from wallet)" : ""}`;
    case "class_cancelled":
      return `${who} cancelled a class booking`;
    case "class_cancelled_by_staff":
      return `Class cancelled — ${title ?? "a class"}`;
    case "points_earned":
      return `${who} earned ${e.amount ?? 0} point${e.amount === 1 ? "" : "s"}`;
    case "sale_package":
      return `${who} bought a package`;
    case "sale_membership":
      return `${who} started a membership`;
    case "sale_dropin":
      return `${who} paid for a drop-in${title ? ` — ${title}` : ""}`;
    case "sale_plan":
      return `${who} bought ${metaStr(e.meta, "name") ?? "a plan"}`;
    case "class_series_created":
      return `New class added — ${title ?? "a class"}`;
    case "class_series_ended":
      return `Class ended — ${title ?? "a class"}`;
    case "refund_desk":
      return `${who} was refunded${metaStr(e.meta, "payMethod") ? ` (${metaStr(e.meta, "payMethod")})` : " at the desk"}`;
    case "class_collected":
      return `${who} paid for a class at the desk`;
    case "wallet_refund":
      return `${who} was refunded to wallet`;
    case "wallet_credit":
      return `${who}'s wallet was credited`;
    case "wallet_reward":
      return `${who} redeemed points for wallet credit`;
    case "wallet_compensation":
      return `${who} was compensated to wallet`;
    case "wallet_expired":
      return `${who}'s wallet credit expired`;
    default:
      return `${who} — ${e.type.replace(/_/g, " ")}`;
  }
}

function amountLabel(e: ActivityEntry): string | null {
  if (e.amount == null) return null;
  if (e.type.startsWith("points")) return `+${e.amount} pts`;
  const sign = e.type === "wallet_expired" ? "−" : "";
  return `${sign}${egp(Math.abs(e.amount))}`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Member feed + full transaction log. Embedded in the dept_head's History
 * tab and in the front desk's Activity screen. */
export function ActivityPanel() {
  const [tab, setTab] = useSticky<"feed" | "logs">("activityTab", "feed", { valid: (v) => v === "feed" || v === "logs" });
  const { data, loading, error } = useAsync(() => api.activity(300), []);
  const entries = data?.activity ?? [];

  return (
    <div>
      <div className="bq-flex bq-items-center bq-gap-3 bq-mb-4">
        <Segmented
          value={tab}
          options={[
            { value: "feed", label: "Feed" },
            { value: "logs", label: "Logs" },
          ]}
          onChange={(v) => setTab(v as "feed" | "logs")}
        />
        <span className="bq-meta bq-rise">
          {tab === "feed" ? "Recent member activity" : "Every transaction and event"}
        </span>
      </div>

      {loading && <InlineSpinner />}
      {error && (
        <div  className="bq-error">{error}</div>
      )}
      {!loading && entries.length === 0 && (
        <EmptyState icon="history" title="Nothing has happened yet" body="Sales, check-ins, bookings, refunds and wallet changes are listed here as they happen." />
      )}

      {tab === "feed" ? <Feed entries={entries} /> : <Logs entries={entries} />}
    </div>
  );
}

export function Feed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="bq-flex bq-col bq-gap-2">
      {entries.map((e) => {
        const tone = CAT_TONE[catOf(e.type)];
        const amt = amountLabel(e);
        return (
          <div key={e.id} className="bq-card bq-activity-panel-feed-row">
            <Tag className="bq-activity-panel-feed-part" tone={tone.tone}>{tone.label}</Tag>
            <span className="bq-grow">
              <span className="bq-activity-panel-feed-text">{describe(e)}</span>
              <span className="bq-activity-panel-feed-meta">{timeLabel(e.at)}{e.actorName ? ` · by ${e.actorName}` : ""}</span>
            </span>
            {amt && <span className={cx(`tabular bq-tone-${tone.tone}`, "bq-activity-panel-feed-title")}>{amt}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Logs({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="bq-panel">
      {entries.map((e, i) => {
        const amt = amountLabel(e);
        return (
          <div className="bq-activity-panel-logs-row" key={e.id} style={{ borderBottom: i === entries.length - 1 ? "none" : "1px solid var(--color-border-primary-default)" }}>
            <span className="bq-activity-panel-logs-meta">{timeLabel(e.at)}</span>
            <span className="bq-activity-panel-logs-label">{e.type}</span>
            <span className="bq-activity-panel-logs-text">{e.clientName ?? "—"}{e.actorName ? ` · by ${e.actorName}` : ""}</span>
            <span className="tabular bq-activity-panel-logs-meta-2">{amt ?? ""}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---- the accountant's view: only the money ----------------------------------

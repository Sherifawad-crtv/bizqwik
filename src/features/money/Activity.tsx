import { EmptyState } from "../../design-system/components/EmptyState";
import { useSticky } from "../../design-system/hooks/useSticky";
import { useNavigate } from "react-router-dom";
import { api } from "../../shared/api/backend";
import { useAsync } from "../../shared/api/useAsync";
import { useAuth } from "../../shared/auth";
import { useSetHeader } from "../../shared/screen/header";
import { egp } from "../../shared/format";
import { InlineSpinner } from "../../design-system/components/Spinner";
import { Icon } from "../../design-system/components/Icon";
import { Segmented } from "../../design-system/components/Segmented";
import { useBackAction } from "../../shared/screen/floatingActions";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { ActivityPanel, Feed } from "../../shared/components/ActivityPanel";
import "./Activity.css";


export function Activity() {
  const { profile, orgMode } = useAuth();
  const navigate = useNavigate();
  useSetHeader({ kicker: "MEMBER APP", title: "Activity" }, []);
  // The desk and a solo owner come from their home screen; a team owner from History.
  const fromHome = profile?.role === "front_desk" || (profile?.role === "dept_head" && orgMode === "solo");
  const back = fromHome ? "/" : "/history";
  const backLabel = profile?.role === "front_desk" ? "Front Desk" : fromHome ? "Today" : "History";
  useBackAction(() => navigate(back));
  const isMobile = useIsMobile();

  return (
    <div>
      {!isMobile && (
      <button className="bq-money-activity-btn"
        onClick={() => navigate(back)}
      >
        <Icon name="chevron-left" size={16} /> {backLabel}
      </button>
      )}
      <div className="bq-money-activity-title">Activity</div>
      <ActivityPanel />
    </div>
  );
}

/** Anything that moves money: sales, desk refunds and collections, wallet changes. */
const isMoney = (type: string) => type.startsWith("sale_") || type.startsWith("wallet_") || type === "refund_desk" || type === "class_collected";

type Kind = "all" | "sales" | "refunds" | "wallet";

const kindOf = (type: string): Exclude<Kind, "all"> =>
  type.startsWith("sale_") || type === "class_collected" ? "sales" : type === "refund_desk" || type === "wallet_refund" ? "refunds" : "wallet";

/** Every transaction on the money side, newest first, with what it adds up to. */
export function Transactions() {
  useSetHeader({ kicker: "MONEY", title: "Transactions" }, []);
  const { data, loading, error } = useAsync(() => api.activity(300), []);
  const [kind, setKind] = useSticky<Kind>("moneyKind", "all", { valid: (v) => ["all","sales","refunds","wallet"].includes(v) });
  const all = (data?.activity ?? []).filter((e) => isMoney(e.type) && e.amount != null);
  const shown = kind === "all" ? all : all.filter((e) => kindOf(e.type) === kind);
  const sum = (k: Exclude<Kind, "all">) => all.filter((e) => kindOf(e.type) === k && e.type !== "wallet_expired").reduce((s, e) => s + Math.abs(e.amount ?? 0), 0);

  return (
    <div>
      <div className="bq-money-activity-transactions-grid">
        {(
          [
            ["SALES", sum("sales"), "Cash, card and wallet sales"],
            ["REFUNDS", sum("refunds"), "Given back to clients"],
            ["WALLET CHANGES", sum("wallet"), "Credits, rewards, expiries"],
          ] as const
        ).map(([label, value, hint]) => (
          <div key={label} className="bq-card bq-card--sm">
            <div className="bq-label">{label}</div>
            <div className="tabular bq-money-activity-transactions-title">{egp(value)}</div>
            <div className="bq-money-activity-transactions-meta">{hint}</div>
          </div>
        ))}
      </div>
      <div className="bq-flex bq-justify-center bq-mb-4">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: "all", label: "ALL" },
            { value: "sales", label: "SALES" },
            { value: "refunds", label: "REFUNDS" },
            { value: "wallet", label: "WALLET" },
          ]}
        />
      </div>
      {loading && <InlineSpinner />}
      {error && <div  className="bq-error bq-rise">{error}</div>}
      {!loading && shown.length === 0 && <EmptyState icon="history" title="No transactions yet" body="Sales, refunds and wallet changes are listed here, newest first, as they happen." />}
      {shown.length > 0 && <Feed entries={shown} />}
      {all.length >= 300 && <div className="bq-money-activity-transactions-meta-2">Showing the latest 300 transactions.</div>}
    </div>
  );
}

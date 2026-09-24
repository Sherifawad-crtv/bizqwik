import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/backend";
import { useAsync } from "../lib/useAsync";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { egp } from "../lib/format";
import type { ActivityEntry } from "../lib/types";
import { Spinner } from "../components/Spinner";
import { Icon } from "../components/Icon";
import { Segmented } from "../components/Segmented";

type Cat = "sale" | "wallet" | "points" | "class" | "checkin" | "other";

function catOf(type: string): Cat {
  if (type.startsWith("sale_")) return "sale";
  if (type.startsWith("wallet_")) return "wallet";
  if (type.startsWith("points")) return "points";
  if (type.startsWith("class")) return "class";
  if (type === "check_in") return "checkin";
  return "other";
}

const CAT_TONE: Record<Cat, { fg: string; bg: string; label: string }> = {
  sale: { fg: "var(--paid-fg)", bg: "var(--paid-bg)", label: "SALE" },
  wallet: { fg: "var(--primary-pressed)", bg: "var(--primary-tint)", label: "WALLET" },
  points: { fg: "var(--settled-fg)", bg: "var(--settled-bg)", label: "POINTS" },
  class: { fg: "var(--logging-fg)", bg: "var(--logging-bg)", label: "CLASS" },
  checkin: { fg: "var(--ink-muted)", bg: "var(--sunken)", label: "CHECK-IN" },
  other: { fg: "var(--ink-muted)", bg: "var(--sunken)", label: "EVENT" },
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
      return `${who} paid for a drop-in`;
    case "wallet_refund":
      return `${who} was refunded to wallet`;
    case "wallet_credit":
      return `${who}'s wallet was credited`;
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

export function Activity() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"feed" | "logs">("feed");
  const { data, loading, error } = useAsync(() => api.activity(300), []);
  useSetHeader({ kicker: "MEMBER APP", title: "Activity" }, []);

  const back = profile?.role === "front_desk" ? "/" : "/oversight";
  const backLabel = profile?.role === "front_desk" ? "Front Desk" : "Oversight";
  const entries = data?.activity ?? [];

  return (
    <div>
      <button
        onClick={() => navigate(back)}
        style={{ display: "inline-flex", alignItems: "center", gap: 4, border: 0, background: "none", color: "var(--ink-muted)", cursor: "pointer", font: "700 14px var(--font-body)", marginBottom: 14, padding: 0 }}
      >
        <Icon name="chevron-left" size={16} /> {backLabel}
      </button>

      <div style={{ font: "800 26px/1.1 var(--font-body)", letterSpacing: "-.02em", marginBottom: 4 }}>Activity</div>
      <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", marginBottom: 16 }}>
        {tab === "feed" ? "Recent member activity" : "Every transaction and event"}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={tab}
          options={[
            { value: "feed", label: "Feed" },
            { value: "logs", label: "Logs" },
          ]}
          onChange={(v) => setTab(v as "feed" | "logs")}
        />
      </div>

      {loading && <Spinner />}
      {error && (
        <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>{error}</div>
      )}
      {!loading && entries.length === 0 && (
        <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "34px 20px", textAlign: "center", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>
          Nothing has happened yet.
        </div>
      )}

      {tab === "feed" ? <Feed entries={entries} /> : <Logs entries={entries} />}
    </div>
  );
}

function Feed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map((e) => {
        const tone = CAT_TONE[catOf(e.type)];
        const amt = amountLabel(e);
        return (
          <div key={e.id} data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ flex: "none", font: "700 10px var(--font-mono)", letterSpacing: ".06em", color: tone.fg, background: tone.bg, borderRadius: 8, padding: "5px 8px", minWidth: 74, textAlign: "center" }}>{tone.label}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", font: "600 14px/1.35 var(--font-body)" }}>{describe(e)}</span>
              <span style={{ display: "block", font: "400 12px var(--font-mono)", color: "var(--ink-faint)", marginTop: 2 }}>{timeLabel(e.at)}</span>
            </span>
            {amt && <span className="tabular" style={{ flex: "none", font: "800 14px var(--font-body)", color: tone.fg }}>{amt}</span>}
          </div>
        );
      })}
    </div>
  );
}

function Logs({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
      {entries.map((e, i) => {
        const amt = amountLabel(e);
        return (
          <div key={e.id} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 14px", borderBottom: i === entries.length - 1 ? "none" : "1px solid var(--line)" }}>
            <span style={{ flex: "none", width: 96, font: "400 11px var(--font-mono)", color: "var(--ink-faint)" }}>{timeLabel(e.at)}</span>
            <span style={{ flex: "none", width: 128, font: "700 11px var(--font-mono)", letterSpacing: ".04em", color: "var(--ink-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.type}</span>
            <span style={{ flex: 1, minWidth: 0, font: "500 13px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.clientName ?? "—"}</span>
            <span className="tabular" style={{ flex: "none", font: "700 12px var(--font-mono)", color: "var(--ink-muted)" }}>{amt ?? ""}</span>
          </div>
        );
      })}
    </div>
  );
}

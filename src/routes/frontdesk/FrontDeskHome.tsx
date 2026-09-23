import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { api } from "../../lib/backend";
import { HomeAvatar } from "../../components/HomeAvatar";
import { MoneyHero } from "../../components/MoneyHero";
import { Icon, type IconName } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { Card, SectionTitle } from "./shared";

const ACTIONS: { key: string; label: string; icon: IconName; to: string; primary?: boolean }[] = [
  { key: "checkin", label: "Check someone in", icon: "check", to: "/checkin", primary: true },
  { key: "new", label: "New client", icon: "user-plus", to: "/members?new=1", primary: true },
  { key: "dropin", label: "Drop-in pass", icon: "ticket", to: "/drop-in" },
  { key: "invite", label: "Guest invitation", icon: "gift", to: "/invitations" },
];

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

export function FrontDeskHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data } = useAsync(() => api.frontDeskSummary(), []);

  useSetHeader({ kicker: "FRONT DESK", title: "Today" }, []);

  if (!profile) return null;
  if (!data) return <Spinner />;

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />

      <MoneyHero
        label="TODAY · CHECK-INS"
        value={String(data.todayCheckIns)}
        stats={[
          { k: "DROP-INS", v: String(data.todayDropIns) },
          { k: "IN THE LAST 2H", v: String(data.activeNow) },
        ]}
      />

      <SectionTitle>Quick actions</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            data-sq
            data-tap
            onClick={() => navigate(a.to)}
            style={{
              minHeight: 120,
              borderRadius: "var(--r-card)",
              border: a.primary ? 0 : "1px solid var(--line)",
              background: a.primary ? "var(--primary)" : "var(--surface)",
              color: a.primary ? "var(--surface)" : "var(--ink)",
              boxShadow: a.primary ? "0 12px 30px rgba(90,65,255,.28)" : "none",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: 18,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <Icon name={a.icon} size={28} />
            <span style={{ font: "700 16px/1.2 var(--font-body)" }}>{a.label}</span>
          </button>
        ))}
      </div>

      <SectionTitle count={data.recent.length}>Recent activity</SectionTitle>
      <Card style={{ overflow: "hidden" }}>
        {data.recent.map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: i === data.recent.length - 1 ? "none" : "1px solid var(--line)" }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                flex: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: r.kind === "check_in" ? "var(--paid-bg)" : "var(--primary-tint)",
                color: r.kind === "check_in" ? "var(--paid-fg)" : "var(--primary-pressed)",
              }}
            >
              <Icon name={r.kind === "check_in" ? "check" : "ticket"} size={18} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{r.detail}</div>
            </div>
            <span style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", whiteSpace: "nowrap" }}>{timeAgo(r.at)}</span>
          </div>
        ))}
        {data.recent.length === 0 && (
          <div style={{ padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>
            <Icon name="inbox" size={26} />
            Nothing yet today.
          </div>
        )}
      </Card>
    </div>
  );
}

import { EmptyState } from "../../components/EmptyState";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { api } from "../../lib/backend";
import { HomeAvatar } from "../../components/HomeAvatar";
import { Icon, type IconName } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { Sheet } from "../../components/Sheet";
import { Card, SectionLink, SectionTitle, SheetHeading, SearchField, PlanPill, planSummary, matchesClient, deskStatus } from "./shared";
import { useCurrentLocation } from "../../lib/locations";
import { NewClientModal } from "./NewClientModal";
import { CheckIn } from "./CheckIn";
import { DropIn } from "./DropIn";
import { Invitations } from "./Invitations";
import { ConfirmCheckInSheet } from "./CheckIn";
import { useFrontDeskCatalog } from "./Members";
import { ClassRosterSheet } from "../../components/ClassRosterSheet";
import { timeLabel, pad } from "../../lib/classTime";
import type { ClientWithPackage, GymClass } from "../../lib/types";

type Modal = "checkin" | "new" | "dropin" | "invite";

// Each one opens right here as a modal; the bottom tabs are for going to a page.
const ACTIONS: { key: Modal; label: string; icon: IconName; primary?: boolean }[] = [
  { key: "new", label: "New client", icon: "user-plus" },
  { key: "dropin", label: "Drop-in pass", icon: "ticket" },
  { key: "invite", label: "Guest invitation", icon: "gift" },
];

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
}

const clockOf = (iso: string) => {
  const d = new Date(iso);
  return timeLabel(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
};

export function FrontDeskHome() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const { data } = useAsync(() => api.frontDeskSummary(), []);
  const [modal, setModal] = useState<Modal | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ClientWithPackage | null>(null);
  const [roster, setRoster] = useState<GymClass | null>(null);
  const clients = useAsync(() => api.clients(), []);
  const classes = useAsync(() => api.classes(new Date(Date.now() - 2 * 3600000).toISOString()), []);
  const { bundleTypes } = useFrontDeskCatalog();
  const { current: here } = useCurrentLocation();
  // Check-ins made straight from the search results (one tap, no sheet).
  const [quick, setQuick] = useState<Record<string, { state: "busy" } | { state: "done"; note: string } | { state: "error"; text: string }>>({});
  const quickCheckIn = async (c: ClientWithPackage) => {
    setQuick((q) => ({ ...q, [c.id]: { state: "busy" } }));
    try {
      const res = await api.checkIn(c.id, "manual", here?.id);
      const p = res.plan;
      setQuick((q) => ({ ...q, [c.id]: { state: "done", note: res.deducted && p ? `Checked in · ${p.creditsRemaining} of ${p.creditsTotal} left` : "Checked in" } }));
    } catch (err) {
      setQuick((q) => ({ ...q, [c.id]: { state: "error", text: err instanceof Error ? err.message : "Couldn't check in." } }));
    }
  };
  const matches = useMemo(() => (clients.data?.clients ?? []).filter((c) => matchesClient(c, query)).slice(0, 6), [clients.data, query]);
  // Today's next classes; once today is over, the next day that has any.
  const { nextUp, nextDay } = useMemo(() => {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const live = (classes.data?.classes ?? []).filter((c) => c.status !== "cancelled").sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const today = live.filter((c) => Date.parse(c.startsAt) + 3600000 >= Date.now() && Date.parse(c.startsAt) <= end.getTime());
    if (today.length) return { nextUp: today.slice(0, 3), nextDay: null as string | null };
    const later = live.filter((c) => Date.parse(c.startsAt) > end.getTime());
    if (!later.length) return { nextUp: [], nextDay: null as string | null };
    const first = new Date(later[0].startsAt);
    const sameDay = (iso: string) => new Date(iso).toDateString() === first.toDateString();
    const tomorrow = new Date(end.getTime() + 1);
    const label = first.toDateString() === tomorrow.toDateString() ? "Tomorrow" : first.toLocaleDateString(undefined, { weekday: "long" });
    return { nextUp: later.filter((c) => sameDay(c.startsAt)).slice(0, 3), nextDay: label };
  }, [classes.data]);
  // A check-in that turns out to need a drop-in hands the client over to it.
  const [dropInFor, setDropInFor] = useState<{ id: string; name: string } | null>(null);
  const close = () => {
    setModal(null);
    setDropInFor(null);
  };

  useSetHeader({ kicker: "FRONT DESK", title: "Today" }, []);

  if (!profile) return null;
  if (!data) return <Spinner />;

  return (
    <div>
      <HomeAvatar name={profile.name} avatarUrl={profile.avatarUrl} greeting={`Hi, ${profile.name.split(" ")[0]}`} />

      <SearchField value={query} onChange={setQuery} placeholder="Find a client by name or phone" />
      {query.trim() !== "" && (
        <Card style={{ marginTop: 10, overflow: "hidden" }}>
          {matches.map((c, i) => {
            const plan = planSummary(c, bundleTypes);
            const status = deskStatus(c);
            const canEnter = status.tone === "good" || status.tone === "warn" || status.tone === "pt";
            const q = quick[c.id];
            return (
              <div key={c.id} data-testid="home-result" style={{ padding: "10px 12px 10px 18px", borderBottom: i === matches.length - 1 ? "none" : "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button
                    data-tap
                    onClick={() => setPicked(c)}
                    style={{ minWidth: 0, flex: 1, display: "block", border: 0, background: "none", padding: "4px 0", cursor: "pointer", textAlign: "left", color: "var(--ink)" }}
                  >
                    <span style={{ display: "block", font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, minWidth: 0 }}>
                      <PlanPill client={c} />
                      <span style={{ font: "400 12px var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{plan.title}</span>
                    </span>
                  </button>
                  {q?.state === "done" ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--paid-fg)", font: "800 14px var(--font-body)", flex: "none" }}>
                      <Icon name="check" size={18} /> Done
                    </span>
                  ) : canEnter ? (
                    <button
                      data-tap
                      disabled={q?.state === "busy"}
                      onClick={() => quickCheckIn(c)}
                      style={{ flex: "none", height: 42, padding: "0 18px", border: 0, borderRadius: 999, background: "var(--primary)", color: "#fff", font: "700 14px var(--font-body)", cursor: "pointer", opacity: q?.state === "busy" ? 0.6 : 1 }}
                    >
                      {q?.state === "busy" ? "…" : "Check in"}
                    </button>
                  ) : (
                    <button
                      data-tap
                      onClick={() => setPicked(c)}
                      style={{ flex: "none", height: 42, padding: "0 16px", border: "1px solid var(--line)", borderRadius: 999, background: "var(--surface)", color: "var(--ink)", font: "700 14px var(--font-body)", cursor: "pointer" }}
                    >
                      Options
                    </button>
                  )}
                </div>
                {q?.state === "done" && <div style={{ font: "400 12px var(--font-mono)", color: "var(--paid-fg)", marginTop: 4 }}>{q.note}</div>}
                {q?.state === "error" && (
                  <div role="alert" style={{ font: "600 12px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 10, padding: "8px 10px", marginTop: 6 }}>
                    {q.text}
                  </div>
                )}
              </div>
            );
          })}
          {matches.length === 0 && <EmptyState bare icon="search" title={`No one matches “${query.trim()}”`} body="Check the spelling, or search by phone number." action={{ label: "+ New client", onClick: () => setModal("new") }} />}
        </Card>
      )}

      <button
        data-tap
        onClick={() => setModal("checkin")}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", height: 64, marginTop: 14, border: 0, borderRadius: "var(--r-card)", background: "var(--primary)", color: "var(--surface)", font: "800 18px var(--font-body)", cursor: "pointer", boxShadow: "0 12px 30px rgba(90,65,255,.28)" }}
      >
        <Icon name="check" size={24} /> Check someone in
      </button>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 10 }}>
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            data-tap
            onClick={() => setModal(a.key)}
            style={{ minHeight: 76, borderRadius: "var(--r-card)", border: "1px solid var(--line)", background: "var(--surface)", color: "var(--ink)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, padding: 8, cursor: "pointer", font: "700 13px/1.2 var(--font-body)", textAlign: "center" }}
          >
            <Icon name={a.icon} size={22} />
            {a.label}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
        {[
          { k: "Checked in today", v: data.todayCheckIns },
          { k: "Drop-ins", v: data.todayDropIns },
          { k: "In the last 2h", v: data.activeNow },
        ].map((x) => (
          <span key={x.k} style={{ font: "600 13px var(--font-body)", color: "var(--ink-muted)", background: "var(--sunken)", borderRadius: 999, padding: "6px 12px" }}>
            <b style={{ color: "var(--ink)", font: "800 14px var(--font-mono)" }}>{x.v}</b> {x.k}
          </span>
        ))}
      </div>

      <SectionTitle right={<SectionLink onClick={() => navigate("/bookings")}>All bookings</SectionLink>}>Next up</SectionTitle>
      <Card style={{ overflow: "hidden", marginBottom: 24 }}>
        {nextDay && nextUp.length > 0 && (
          <div data-testid="next-day-label" style={{ padding: "12px 18px 0", font: "600 13px var(--font-body)", color: "var(--ink-muted)" }}>
            Nothing left today · {nextDay}
          </div>
        )}
        {nextUp.map((c, i) => (
          <button
            key={c.id}
            data-tap
            onClick={() => setRoster(c)}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", minHeight: 60, padding: "12px 18px", border: 0, borderBottom: i === nextUp.length - 1 ? "none" : "1px solid var(--line)", background: "none", cursor: "pointer", textAlign: "left" }}
          >
            <span style={{ width: 84, flex: "none", whiteSpace: "nowrap", font: "700 14px var(--font-mono)" }}>{clockOf(c.startsAt)}</span>
            <span style={{ minWidth: 0, flex: 1 }}>
              <span style={{ display: "block", font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</span>
              <span style={{ display: "block", font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{(c.bookedCount ?? 0) === 0 ? "No one booked" : `${c.bookedCount} booked`}</span>
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
        {nextUp.length === 0 && <EmptyState bare icon="calendar" title="No more classes today" body="Upcoming classes show up here." />}
      </Card>

      <SectionTitle right={<SectionLink onClick={() => navigate("/activity")}>Full activity &amp; logs</SectionLink>}>Recent activity</SectionTitle>
      <Card style={{ overflow: "hidden" }}>
        {data.recent.slice(0, 5).map((r, i) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderBottom: i === Math.min(data.recent.length, 5) - 1 ? "none" : "1px solid var(--line)" }}>
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
          <EmptyState bare icon="inbox" title="Nothing yet today" body="Check-ins and drop-ins show up here as they happen." />
        )}
      </Card>


      <Sheet open={modal === "checkin"} onClose={close}>
        <SheetHeading kicker="FRONT DESK" title="Check-In" />
        <CheckIn
          embedded
          onCreateClient={() => setModal("new")}
          onDropIn={(c) => {
            setDropInFor({ id: c.id, name: c.name });
            setModal("dropin");
          }}
        />
      </Sheet>
      <Sheet open={modal === "dropin"} onClose={close}>
        <SheetHeading kicker="FRONT DESK" title="Drop-In" />
        <DropIn embedded initialClient={dropInFor} />
      </Sheet>
      <Sheet open={modal === "invite"} onClose={close}>
        <SheetHeading kicker="FRONT DESK" title="Guest invitation" />
        <Invitations embedded onCreateClient={() => setModal("new")} />
      </Sheet>
      <ConfirmCheckInSheet
        client={picked}
        onClose={() => {
          setPicked(null);
          setQuery("");
        }}
        onDropIn={(c) => {
          setPicked(null);
          setDropInFor({ id: c.id, name: c.name });
          setModal("dropin");
        }}
      />
      <ClassRosterSheet open={roster !== null} onClose={() => setRoster(null)} classId={roster?.id ?? null} title={roster?.title ?? "Class"} onChanged={classes.refetch} />
      {modal === "new" && <NewClientModal onClose={close} />}
    </div>
  );
}

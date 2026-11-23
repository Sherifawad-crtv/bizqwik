import { cx } from "../../../design-system/cx";
import { EmptyState } from "../../../design-system/components/EmptyState";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../shared/auth";
import { useSetHeader } from "../../../shared/screen/header";
import { useAsync } from "../../../shared/api/useAsync";
import { desk, useDeskClients } from "./hooks/useDesk";
import { HomeAvatar } from "../../../shared/components/HomeAvatar";
import { Icon, type IconName } from "../../../design-system/components/Icon";
import { Spinner } from "../../../design-system/components/Spinner";
import { Sheet } from "../../../design-system/components/Sheet";
import { SectionLink, SheetHeading, SearchField } from "./shared";
import { PlanPill } from "../../../shared/components/PlanPill";
import { Card } from "../../../design-system/components/Card";
import { SectionHeader } from "../../../design-system/components/SectionHeader";
import { planSummary, matchesClient, deskStatus } from "../../../shared/deskStatus";
import { useCurrentLocation } from "../../../shared/locations";
import { NewClientModal } from "./NewClientModal";
import { CheckIn } from "./CheckIn";
import { DropIn } from "./DropIn";
import { Invitations } from "./Invitations";
import { ConfirmCheckInSheet } from "./CheckIn";
import { useFrontDeskCatalog } from "./members/offers";
import { ClassRosterSheet } from "../../../shared/components/ClassRosterSheet";
import { timeLabel, pad } from "../../../shared/classTime";
import type { ClientWithPackage, GymClass } from "../../../shared/types";
import { useNow } from "../../../shared/useNow";
import "./FrontDeskHome.css";

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
  const { data } = useAsync(() => desk.frontDeskSummary(), []);
  const [modal, setModal] = useState<Modal | null>(null);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<ClientWithPackage | null>(null);
  const [roster, setRoster] = useState<GymClass | null>(null);
  const clients = useDeskClients();
  const classes = useAsync(() => desk.classes(new Date(Date.now() - 2 * 3600000).toISOString()), []);
  const { bundleTypes } = useFrontDeskCatalog();
  const { current: here } = useCurrentLocation();
  // Check-ins made straight from the search results (one tap, no sheet).
  const [quick, setQuick] = useState<Record<string, { state: "busy" } | { state: "done"; note: string } | { state: "error"; text: string }>>({});
  const quickCheckIn = async (c: ClientWithPackage) => {
    setQuick((q) => ({ ...q, [c.id]: { state: "busy" } }));
    try {
      const res = await desk.checkIn(c.id, "manual", here?.id);
      const p = res.plan;
      setQuick((q) => ({ ...q, [c.id]: { state: "done", note: res.deducted && p ? `Checked in · ${p.creditsRemaining} of ${p.creditsTotal} left` : "Checked in" } }));
    } catch (err) {
      setQuick((q) => ({ ...q, [c.id]: { state: "error", text: err instanceof Error ? err.message : "Couldn't check in." } }));
    }
  };
  const matches = useMemo(() => (clients.data?.clients ?? []).filter((c) => matchesClient(c, query)).slice(0, 6), [clients.data, query]);
  // Today's next classes; once today is over, the next day that has any.
  const now = useNow();
  const { nextUp, nextDay } = useMemo(() => {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const live = (classes.data?.classes ?? []).filter((c) => c.status !== "cancelled").sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
    const today = live.filter((c) => Date.parse(c.startsAt) + 3600000 >= now && Date.parse(c.startsAt) <= end.getTime());
    if (today.length) return { nextUp: today.slice(0, 3), nextDay: null as string | null };
    const later = live.filter((c) => Date.parse(c.startsAt) > end.getTime());
    if (!later.length) return { nextUp: [], nextDay: null as string | null };
    const first = new Date(later[0].startsAt);
    const sameDay = (iso: string) => new Date(iso).toDateString() === first.toDateString();
    const tomorrow = new Date(end.getTime() + 1);
    const label = first.toDateString() === tomorrow.toDateString() ? "Tomorrow" : first.toLocaleDateString(undefined, { weekday: "long" });
    return { nextUp: later.filter((c) => sameDay(c.startsAt)).slice(0, 3), nextDay: label };
  }, [classes.data, now]);
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
        <Card className="bq-mt-2 bq-overflow-hidden" pad="none">
          {matches.map((c, i) => {
            const plan = planSummary(c, bundleTypes);
            const status = deskStatus(c);
            const canEnter = status.tone === "good" || status.tone === "warn" || status.tone === "pt";
            const q = quick[c.id];
            return (
              <div className="bq-frontdesk-front-desk-home-spacing" key={c.id} data-testid="home-result" style={{ borderBottom: i === matches.length - 1 ? "none" : "var(--border-divider)" }}>
                <div className="bq-flex bq-items-center bq-gap-3">
                  <button
                    className="bq-scale bq-frontdesk-front-desk-home-btn"
                    onClick={() => setPicked(c)}
                  >
                    <span className="bq-frontdesk-front-desk-home-title">{c.name}</span>
                    <span className="bq-flex bq-items-center bq-gap-2 bq-mt-1 bq-min-w-0">
                      <PlanPill client={c} />
                      <span className="bq-frontdesk-front-desk-home-meta">{plan.title}</span>
                    </span>
                  </button>
                  {q?.state === "done" ? (
                    <span className="bq-frontdesk-front-desk-home-title-2">
                      <Icon name="check" size={18} /> Done
                    </span>
                  ) : canEnter ? (
                    <button
                      className="bq-scale bq-frontdesk-front-desk-home-btn-2"
                      disabled={q?.state === "busy"}
                      onClick={() => quickCheckIn(c)}
                      style={{ opacity: q?.state === "busy" ? 0.6 : 1 }}
                    >
                      {q?.state === "busy" ? "…" : "Check in"}
                    </button>
                  ) : (
                    <button
                      className="bq-scale bq-frontdesk-front-desk-home-btn-3"
                      onClick={() => setPicked(c)}
                    >
                      Options
                    </button>
                  )}
                </div>
                {q?.state === "done" && <div className="bq-frontdesk-front-desk-home-meta-2">{q.note}</div>}
                {q?.state === "error" && (
                  <div className="bq-frontdesk-front-desk-home-text" role="alert">
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
        className="bq-scale bq-frontdesk-front-desk-home-btn-4"
        onClick={() => setModal("checkin")}
      >
        <Icon name="check" size={24} /> Check someone in
      </button>
      <div className="bq-frontdesk-front-desk-home-grid">
        {ACTIONS.map((a) => (
          <button
            key={a.key}
            className="bq-scale bq-card bq-frontdesk-front-desk-home-btn-5"
            onClick={() => setModal(a.key)}
          >
            <Icon name={a.icon} size={22} />
            {a.label}
          </button>
        ))}
      </div>

      <div className="bq-flex bq-gap-2 bq-mt-4 bq-wrap">
        {[
          { k: "Checked in today", v: data.todayCheckIns },
          { k: "Drop-ins", v: data.todayDropIns },
          { k: "In the last 2h", v: data.activeNow },
        ].map((x) => (
          <span className="bq-frontdesk-front-desk-home-text-2" key={x.k}>
            <b className="bq-frontdesk-front-desk-home-meta-3">{x.v}</b> {x.k}
          </span>
        ))}
      </div>

      <SectionHeader right={<SectionLink onClick={() => navigate("/bookings")}>All bookings</SectionLink>}>Next up</SectionHeader>
      <Card className="bq-overflow-hidden bq-mb-6" pad="none">
        {nextDay && nextUp.length > 0 && (
          <div className="bq-frontdesk-front-desk-home-text-3" data-testid="next-day-label">
            Nothing left today · {nextDay}
          </div>
        )}
        {nextUp.map((c, i) => (
          <button
            key={c.id}
            className={cx(`bq-plain bq-scale bq-listrow bq-listrow--compact ${!(i === nextUp.length - 1) ? "bq-listrow--divider" : ""}`, "bq-frontdesk-front-desk-home-btn-6")}
            onClick={() => setRoster(c)}
          >
            <span className="bq-frontdesk-front-desk-home-meta-4">{clockOf(c.startsAt)}</span>
            <span className="bq-grow">
              <span className="bq-frontdesk-front-desk-home-title-3">{c.title}</span>
              <span className="bq-frontdesk-front-desk-home-meta-5">{(c.bookedCount ?? 0) === 0 ? "No one booked" : `${c.bookedCount} booked`}</span>
            </span>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
        {nextUp.length === 0 && <EmptyState bare icon="calendar" title="No more classes today" body="Upcoming classes show up here." />}
      </Card>

      <SectionHeader right={<SectionLink onClick={() => navigate("/activity")}>Full activity &amp; logs</SectionLink>}>Recent activity</SectionHeader>
      <Card className="bq-overflow-hidden" pad="none">
        {data.recent.slice(0, 5).map((r, i) => (
          <div className="bq-frontdesk-front-desk-home-row" key={r.id} style={{ borderBottom: i === Math.min(data.recent.length, 5) - 1 ? "none" : "1px solid var(--color-border-primary-default)" }}>
            <span className="bq-frontdesk-front-desk-home-row-2"
              style={{ background: r.kind === "check_in" ? "var(--color-bg-fill-status-paid-default)" : "var(--color-bg-fill-accent-default)", color: r.kind === "check_in" ? "var(--color-text-status-paid-default)" : "var(--color-bg-fill-primary-active)" }}
            >
              <Icon name={r.kind === "check_in" ? "check" : "ticket"} size={18} />
            </span>
            <div className="bq-grow">
              <div className="bq-frontdesk-front-desk-home-title-4">{r.name}</div>
              <div className="bq-meta">{r.detail}</div>
            </div>
            <span className="bq-frontdesk-front-desk-home-meta-6">{timeAgo(r.at)}</span>
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

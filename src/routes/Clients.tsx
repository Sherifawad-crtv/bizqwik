import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api, MOCK } from "../lib/backend";
import { Spinner } from "../components/Spinner";
import type { CoachOption } from "./clients/helpers";
import { ClientList } from "./clients/List";

export function Clients() {
  const { profile } = useAuth();
  // dept_head sees the full roster, read-only apart from edits, deletes and
  // goodwill credit: registering clients and selling plans/packages is the
  // front desk's job. Head coach's private-training role is the same as a
  // plain coach's: view their own assigned clients and log deliveries.
  const isDeptHead = profile?.role === "dept_head";

  const { data } = useAsync(() => api.clients(), []);
  const { data: monthData } = useAsync(() => (isDeptHead ? api.month(MOCK.CURRENT_MONTH) : Promise.resolve(null)), [isDeptHead]);

  useSetHeader({ kicker: isDeptHead ? "MEMBERS" : "PRIVATE TRAINING", title: "Clients" }, [isDeptHead]);

  if (!profile) return null;
  if (!data) return <Spinner />;

  const coachOptions: CoachOption[] = (monthData?.rows ?? []).map((r) => ({ id: r.coachId, name: r.name }));
  const visibleClients = isDeptHead ? data.clients : data.clients.filter((c) => c.assignedCoachId === profile.id);
  const coachName = (id: string | null) => (id ? (coachOptions.find((c) => c.id === id)?.name ?? "—") : null);

  return (
    <ClientList
      clients={visibleClients}
      role={profile.role}
      myId={profile.id}
      coachName={coachName}
      showAssignedCoach={isDeptHead}
      canManage={isDeptHead}
    />
  );
}

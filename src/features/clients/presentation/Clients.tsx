import { useAuth } from "../../../shared/auth";
import { useSetHeader } from "../../../shared/screen/header";
import { Spinner } from "../../../design-system/components/Spinner";
import { useClients } from "./hooks/useClients";
import { ClientList } from "./List";

export function Clients() {
  const { profile } = useAuth();
  const { isManager, loading, clients, coachName } = useClients(profile);

  useSetHeader({ kicker: isManager ? "MEMBERS" : "PRIVATE TRAINING", title: "Clients" }, [isManager]);

  if (!profile) return null;
  if (loading) return <Spinner />;

  return (
    <ClientList
      clients={clients}
      role={profile.role}
      myId={profile.id}
      coachName={coachName}
      showAssignedCoach={isManager}
      canManage={isManager}
    />
  );
}

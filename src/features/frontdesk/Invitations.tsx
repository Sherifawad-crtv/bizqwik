import { useState } from "react";
import { useSetHeader } from "../../shared/screen/header";
import { useAsync } from "../../shared/api/useAsync";
import { api } from "../../shared/api/backend";
import { dateLabel, todayIso } from "../../shared/format";
import { Button } from "../../design-system/components/Button";
import { TextField } from "../../design-system/components/FormField";
import { Icon } from "../../design-system/components/Icon";
import { Spinner } from "../../design-system/components/Spinner";
import { ClientPicker } from "./shared";
import { ErrorBanner } from "../../design-system/components/ErrorBanner";
import { Card } from "../../design-system/components/Card";
import { SectionHeader } from "../../design-system/components/SectionHeader";
import { useNewClient } from "./NewClientModal";
import { useFrontDeskCatalog } from "./members/offers";
import "./Invitations.css";

export function Invitations({ embedded = false, onCreateClient }: { embedded?: boolean; onCreateClient?: () => void } = {}) {
  useSetHeader(embedded ? null : { kicker: "FRONT DESK", title: "Invitations" }, []);
  const { data } = useAsync(() => api.clients(), []);
  const { bundleTypes } = useFrontDeskCatalog();
  const newClient = useNewClient();
  const [memberId, setMemberId] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [visitDate, setVisitDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  if (!data) return <Spinner />;

  const member = data.clients.find((c) => c.id === memberId) ?? null;
  const plan = member?.groupPlan ?? null;
  const left = plan?.invitationsRemaining ?? 0;

  const submit = async () => {
    if (!member) return;
    if (!guestName.trim() || !guestPhone.trim() || !visitDate) {
      setError("Guest name, phone and visit date are all required.");
      return;
    }
    if (visitDate < todayIso()) {
      setError("The visit date can't be in the past.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.invite(member.id, guestName.trim(), guestPhone.trim(), visitDate);
      setDone(`${guestName.trim()} is invited for ${dateLabel(visitDate)} · ${res.invitationsRemaining} left for ${member.name}`);
      setGuestName("");
      setGuestPhone("");
      setVisitDate("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Card className="bq-frontdesk-invitations-card" pad="none">
        <span className="bq-frontdesk-invitations-row">
          <Icon name="gift" size={22} />
        </span>
        <div>
          <div className="bq-h3">Guest invitations</div>
          <div className="bq-frontdesk-invitations-meta">Members on an active plan can bring guests, up to the guest passes their plan includes.</div>
        </div>
      </Card>

      {done && (
        <div className="bq-frontdesk-invitations-text">
          Invitation recorded — {done}
        </div>
      )}

      {!member ? (
        <>
          <SectionHeader>Choose the member</SectionHeader>
          <ClientPicker
            clients={data.clients}
            bundleTypes={bundleTypes}
            filter={(c) => (c.groupPlan?.invitationsRemaining ?? 0) > 0}
            emptyTitle="No one has guest passes left"
            emptyBody="Guest passes come with membership plans that include them. Set a plan's guest passes in Catalog, then sell it to a member."
            onCreate={onCreateClient ?? newClient.open}
            onPick={(c) => {
              setMemberId(c.id);
              setError(null);
            }}
          />
        </>
      ) : (
        <>
          <Card className="bq-frontdesk-invitations-card-2" pad="none">
            <div className="bq-flex bq-items-center bq-gap-10px">
              <div className="bq-grow">
                <div className="bq-label">MEMBER</div>
                <div className="bq-frontdesk-invitations-title">{member.name}</div>
              </div>
              <Button className="bq-frontdesk-invitations-btn"
                variant="quiet"
                size="md"
                onClick={() => {
                  setMemberId(null);
                  setDone(null);
                  setError(null);
                }}
              >
                Change
              </Button>
            </div>
            <div className="bq-flex bq-items-baseline bq-gap-2 bq-mt-10px">
              <span className="bq-frontdesk-invitations-title-2" style={{ color: left > 0 ? "var(--color-bg-fill-primary-active)" : "var(--color-text-tertiary-default)" }}>{left}</span>
              <span className="bq-frontdesk-invitations-meta-2">invitation{left === 1 ? "" : "s"} left</span>
            </div>
          </Card>

          {left > 0 ? (
            <>
              <div className="bq-stack">
                <TextField label="GUEST NAME" value={guestName} onChange={(e) => setGuestName(e.target.value)} autoComplete="off" />
                <TextField label="GUEST PHONE" type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} autoComplete="off" />
                <TextField label="VISIT DATE" type="date" min={todayIso()} value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
              </div>
              {error && <ErrorBanner text={error} />}
              <Button className="bq-mt-4" fullWidth size="lg" disabled={busy} onClick={submit}>
                {busy ? "Saving…" : "Record invitation"}
              </Button>
            </>
          ) : (
            <div  className="bq-error bq-rise">
              {member.name} has used every guest pass on this plan.
            </div>
          )}
        </>
      )}
      {newClient.modal}
    </div>
  );
}

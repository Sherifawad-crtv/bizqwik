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
      <Card pad="none" style={{ padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{ color: "var(--color-bg-fill-primary-active)", display: "flex", marginTop: 2 }}>
          <Icon name="gift" size={22} />
        </span>
        <div>
          <div className="bq-h3">Guest invitations</div>
          <div style={{ font: "400 var(--text-footnote-size)/1.5 var(--font-family-mono)", color: "var(--color-text-secondary-default)" }}>Members on an active plan can bring guests, up to the guest passes their plan includes.</div>
        </div>
      </Card>

      {done && (
        <div style={{ marginBottom: 14, font: "600 var(--text-footnote-size)/1.5 var(--font-family-body)", color: "var(--color-text-status-paid-default)", background: "var(--color-bg-fill-status-paid-default)", borderRadius: "var(--radius-item)", padding: "10px 14px" }}>
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
          <Card pad="none" style={{ padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div className="bq-grow">
                <div className="bq-label">MEMBER</div>
                <div style={{ font: "800 var(--text-title-2-size) var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</div>
              </div>
              <Button
                variant="quiet"
                size="md"
                style={{ height: 36, padding: "0 12px" }}
                onClick={() => {
                  setMemberId(null);
                  setDone(null);
                  setError(null);
                }}
              >
                Change
              </Button>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
              <span style={{ font: "800 34px/1 var(--font-family-body)", letterSpacing: "-.02em", color: left > 0 ? "var(--color-bg-fill-primary-active)" : "var(--color-text-tertiary-default)" }}>{left}</span>
              <span style={{ font: "400 var(--text-footnote-size) var(--font-family-mono)", color: "var(--color-text-secondary-default)" }}>invitation{left === 1 ? "" : "s"} left</span>
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
              <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={submit}>
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

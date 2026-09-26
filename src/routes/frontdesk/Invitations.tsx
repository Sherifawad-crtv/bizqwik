import { useState } from "react";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { api } from "../../lib/backend";
import { dateLabel, todayIso } from "../../lib/format";
import { Button } from "../../components/Button";
import { TextField } from "../../components/FormField";
import { Icon } from "../../components/Icon";
import { Spinner } from "../../components/Spinner";
import { Card, ClientPicker, ErrorBanner, SectionTitle } from "./shared";
import { useFrontDeskCatalog } from "./Members";

export function Invitations() {
  useSetHeader({ kicker: "FRONT DESK", title: "Invitations" }, []);
  const { data } = useAsync(() => api.clients(), []);
  const { bundleTypes } = useFrontDeskCatalog();
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
      <Card style={{ padding: "16px 18px", display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 16 }}>
        <span style={{ color: "var(--primary-pressed)", display: "flex", marginTop: 2 }}>
          <Icon name="gift" size={22} />
        </span>
        <div>
          <div style={{ font: "700 16px var(--font-body)" }}>Guest invitations</div>
          <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-muted)" }}>Members on an active plan can bring guests, up to the guest passes their plan includes.</div>
        </div>
      </Card>

      {done && (
        <div style={{ marginBottom: 14, font: "600 13px/1.5 var(--font-body)", color: "var(--paid-fg)", background: "var(--paid-bg)", borderRadius: 14, padding: "10px 14px" }}>
          Invitation recorded — {done}
        </div>
      )}

      {!member ? (
        <>
          <SectionTitle>Choose the member</SectionTitle>
          <ClientPicker
            clients={data.clients}
            bundleTypes={bundleTypes}
            filter={(c) => (c.groupPlan?.invitationsRemaining ?? 0) > 0}
            emptyTitle="No one has guest passes left"
            emptyBody="Guest passes come with membership plans that include them. Set a plan's guest passes in Catalog, then sell it to a member."
            onPick={(c) => {
              setMemberId(c.id);
              setError(null);
            }}
          />
        </>
      ) : (
        <>
          <Card style={{ padding: "16px 18px", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>MEMBER</div>
                <div style={{ font: "800 20px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{member.name}</div>
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
              <span style={{ font: "800 34px/1 var(--font-body)", letterSpacing: "-.02em", color: left > 0 ? "var(--primary-pressed)" : "var(--ink-faint)" }}>{left}</span>
              <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>invitation{left === 1 ? "" : "s"} left</span>
            </div>
          </Card>

          {left > 0 ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            <div style={{ font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {member.name} has used every guest pass on this plan.
            </div>
          )}
        </>
      )}
    </div>
  );
}

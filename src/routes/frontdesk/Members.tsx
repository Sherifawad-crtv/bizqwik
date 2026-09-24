import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useSetHeader } from "../../lib/header";
import { useAsync } from "../../lib/useAsync";
import { useLatch } from "../../lib/useLatch";
import { useSheetSuccess } from "../../lib/useSheetSuccess";
import { api } from "../../lib/backend";
import { fmt, dateLabel } from "../../lib/format";
import type { BundleType, ClientWithPackage, CoachOption, MembershipType } from "../../lib/types";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { Segmented } from "../../components/Segmented";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { TextField, SelectField } from "../../components/FormField";
import { Spinner } from "../../components/Spinner";
import { Icon } from "../../components/Icon";
import { Card, ErrorBanner, PlanPill, SearchField, SectionTitle, matchesClient, planSummary } from "./shared";

export function useFrontDeskCatalog() {
  const { data: m } = useAsync(() => api.membershipTypes(), []);
  const { data: b } = useAsync(() => api.bundleTypes(), []);
  return { membershipTypes: m?.membershipTypes ?? [], bundleTypes: b?.bundleTypes ?? [] };
}

export function Members() {
  useSetHeader({ kicker: "FRONT DESK", title: "Clients" }, []);
  const [params, setParams] = useSearchParams();
  const createRequested = params.get("new") === "1";
  const { data } = useAsync(() => api.clients(), []);
  const { data: coachData } = useAsync(() => api.coaches(), []);
  const { membershipTypes, bundleTypes } = useFrontDeskCatalog();
  const coaches = coachData?.coaches ?? [];

  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // The home screen's "New client" quick action lands on ?new=1. It's read
  // from the URL (not router state) because the tab slide remounts this
  // screen when it finishes, and opening waits for that slide to end.
  useEffect(() => {
    if (!createRequested) return;
    const t = window.setTimeout(() => setCreating(true), 360);
    return () => window.clearTimeout(t);
  }, [createRequested]);
  const closeCreate = () => {
    setCreating(false);
    if (createRequested) setParams({}, { replace: true });
  };

  const clients = data?.clients ?? [];
  const shown = useMemo(() => clients.filter((c) => matchesClient(c, query)), [clients, query]);
  const selected = clients.find((c) => c.id === selectedId) ?? null;

  if (!data) return <Spinner />;

  const activeCount = clients.filter((c) => planSummary(c, membershipTypes, bundleTypes).tone === "active").length;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
        <Stat label="CLIENTS" value={clients.length} />
        <Stat label="ACTIVE PLANS" value={activeCount} />
      </div>

      <SectionTitle
        count={shown.length}
        right={
          <Button size="md" style={{ height: 40, padding: "0 16px" }} onClick={() => setCreating(true)}>
            + New client
          </Button>
        }
      >
        Roster
      </SectionTitle>
      <SearchField value={query} onChange={setQuery} />

      <Card style={{ marginTop: 10, overflow: "hidden" }}>
        {shown.map((c, i) => {
          const plan = planSummary(c, membershipTypes, bundleTypes);
          return (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "14px 18px", border: 0, borderBottom: i === shown.length - 1 ? "none" : "1px solid var(--line)", background: "none", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {plan.title} · {plan.detail}
                </div>
              </div>
              <PlanPill tone={plan.tone} />
              <Icon name="chevron-right" size={16} />
            </button>
          );
        })}
        {shown.length === 0 && (
          <div style={{ padding: "28px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>
            <Icon name="clients" size={26} />
            {clients.length === 0 ? "No clients yet." : "No clients match."}
          </div>
        )}
      </Card>

      <CreateClientSheet open={creating} onClose={closeCreate} membershipTypes={membershipTypes} bundleTypes={bundleTypes} coaches={coaches} />
      <ClientSheet client={selected} onClose={() => setSelectedId(null)} membershipTypes={membershipTypes} bundleTypes={bundleTypes} coaches={coaches} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card style={{ padding: "16px 18px" }}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{label}</div>
      <div style={{ font: "800 30px/1.1 var(--font-body)", letterSpacing: "-.02em", marginTop: 6 }}>{value}</div>
    </Card>
  );
}

type PlanKind = "membership" | "service";

const membershipOptions = (types: MembershipType[]) =>
  types.map((t) => ({ value: t.id, label: `${t.name} · ${fmt(t.price)} EGP · ${t.durationDays} days` }));
const bundleOptions = (types: BundleType[]) =>
  types.map((b) => ({ value: b.id, label: `${b.name} · ${fmt(b.price)} EGP · ${b.sessionsIncluded} sessions` }));
const coachOptions = (coaches: CoachOption[]) => coaches.map((c) => ({ value: c.id, label: c.name }));

function SheetHeading({ kicker, title }: { kicker: string; title: string }) {
  return (
    <>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{kicker}</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{title}</div>
    </>
  );
}

export function CreateClientSheet({
  open,
  onClose,
  membershipTypes,
  bundleTypes,
  coaches,
}: {
  open: boolean;
  onClose: () => void;
  membershipTypes: MembershipType[];
  bundleTypes: BundleType[];
  coaches: CoachOption[];
}) {
  const [kind, setKind] = useState<PlanKind>("membership");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [membershipTypeId, setMembershipTypeId] = useState("");
  const [bundleTypeId, setBundleTypeId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (open) {
      setKind("membership");
      setName("");
      setPhone("");
      setEmail("");
      setMembershipTypeId("");
      setBundleTypeId("");
      setCoachId("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = async () => {
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone number are required.");
      return;
    }
    if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError("That email doesn't look right — fix it or leave it blank.");
      return;
    }
    if (kind === "membership" && !membershipTypeId) {
      setError("Choose a membership.");
      return;
    }
    if (kind === "service" && (!bundleTypeId || !coachId)) {
      setError("Choose a package and a coach.");
      return;
    }
    const fields = { name: name.trim(), phone: phone.trim(), email: email.trim() || null };
    setBusy(true);
    setError(null);
    try {
      if (kind === "membership") await api.sellMembership(fields, membershipTypeId);
      else await api.createServiceClient(fields, bundleTypeId, coachId);
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      {confirmed ? (
        <SheetSuccessIcon label="Client created" iconIn={iconIn} />
      ) : (
        <>
          <SheetHeading kicker="NEW CLIENT" title="Create client" />
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
            <Segmented
              value={kind}
              onChange={(v) => {
                setKind(v);
                setError(null);
              }}
              options={[
                { value: "membership", label: "MEMBERSHIP" },
                { value: "service", label: "SERVICE" },
              ]}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField label="FULL NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Client name" autoComplete="off" />
            <TextField label="PHONE" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01xxxxxxxxx" autoComplete="off" />
            <TextField label="EMAIL (OPTIONAL)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            {kind === "membership" ? (
              <SelectField
                label="MEMBERSHIP"
                value={membershipTypeId}
                onChange={setMembershipTypeId}
                placeholder={membershipTypes.length ? "Choose a membership" : "No memberships set up yet"}
                disabled={membershipTypes.length === 0}
                options={membershipOptions(membershipTypes)}
              />
            ) : (
              <>
                <SelectField label="PACKAGE" value={bundleTypeId} onChange={setBundleTypeId} placeholder="Choose a package" options={bundleOptions(bundleTypes)} />
                <SelectField label="COACH" value={coachId} onChange={setCoachId} placeholder="Choose a coach" options={coachOptions(coaches)} />
              </>
            )}
          </div>
          {kind === "membership" && membershipTypes.length === 0 && (
            <div style={{ marginTop: 10, font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
              A department head needs to add memberships under Tiers &amp; People → Bundles first.
            </div>
          )}
          {error && <ErrorBanner text={error} />}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={submit}>
            {busy ? "Saving…" : kind === "membership" ? "Create & start membership" : "Create & sell package"}
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

type Mode = "view" | "renew-membership" | "renew-package" | "assign" | "invite";

function ClientSheet({
  client,
  onClose,
  membershipTypes,
  bundleTypes,
  coaches,
}: {
  client: ClientWithPackage | null;
  onClose: () => void;
  membershipTypes: MembershipType[];
  bundleTypes: BundleType[];
  coaches: CoachOption[];
}) {
  const shown = useLatch(client);
  const [mode, setMode] = useState<Mode>("view");
  const [pickId, setPickId] = useState("");
  const [coachId, setCoachId] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = !!client;
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose);

  useEffect(() => {
    if (client) {
      setMode("view");
      setPickId("");
      setCoachId(client.assignedCoachId ?? "");
      setEmail(client.email ?? "");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id]);

  if (!shown) return null;

  const membership = shown.currentMembership ?? null;
  const pkg = shown.currentPackage;
  const membershipActive = membership?.status === "active";
  const packageActive = pkg?.status === "active";
  const mType = membership ? membershipTypes.find((t) => t.id === membership.membershipTypeId) : undefined;
  const bType = pkg ? bundleTypes.find((b) => b.id === pkg.bundleTypeId) : undefined;
  const coachName = coaches.find((c) => c.id === shown.assignedCoachId)?.name ?? null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      showSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const confirmMode = () => {
    if (mode === "renew-membership") {
      if (!pickId) return setError("Choose a membership.");
      return run(() => api.sellMembership({ clientId: shown.id }, pickId));
    }
    if (mode === "renew-package") {
      if (!pickId || !coachId) return setError("Choose a package and a coach.");
      return run(() => api.sellPackage(shown.id, pickId, coachId));
    }
    if (mode === "assign") {
      if (!coachId) return setError("Choose a coach.");
      return run(() => api.assignCoach(shown.id, coachId));
    }
    if (mode === "invite") {
      const e = email.trim();
      if (!/^\S+@\S+\.\S+$/.test(e)) return setError("Enter a valid email.");
      return run(() => api.inviteClient(shown.id, e));
    }
  };

  const successLabel =
    mode === "assign" ? "Coach assigned" : mode === "invite" ? "Invitation sent" : mode === "renew-membership" ? "Membership started" : "Package sold";

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        {confirmed ? (
          <SheetSuccessIcon label={successLabel} iconIn={iconIn} />
        ) : mode === "view" ? (
          <>
            <SheetHeading kicker="CLIENT" title={shown.name} />
            <div style={{ font: "400 13px/1.6 var(--font-mono)", color: "var(--ink-muted)", marginTop: -8, marginBottom: 14 }}>
              {shown.phone ?? "No phone"}
              {shown.email ? ` · ${shown.email}` : ""}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <PlanCard
                label="MEMBERSHIP"
                title={mType?.name ?? (membership ? "Membership" : "None")}
                tone={membership ? (membershipActive ? "active" : "expired") : "none"}
                lines={
                  membership
                    ? [
                        membershipActive ? `Until ${dateLabel(membership.expiryDate)}` : `Ended ${dateLabel(membership.expiryDate)}`,
                        `${membership.invitationsRemaining} guest invitation${membership.invitationsRemaining === 1 ? "" : "s"} left`,
                      ]
                    : []
                }
              />
              <PlanCard
                label="PACKAGE"
                title={bType?.name ?? (pkg ? "Package" : "None")}
                tone={pkg ? (packageActive ? "active" : "expired") : "none"}
                lines={pkg ? [`${pkg.sessionsRemaining} of ${pkg.sessionsIncluded} sessions left`, `Expires ${dateLabel(pkg.expiryDate)}`] : []}
              />
              <PlanCard label="COACH" title={coachName ?? "Not assigned"} tone={null} lines={[]} />
            </div>

            {error && <ErrorBanner text={error} />}

            <Button fullWidth style={{ marginTop: 16 }} disabled={membershipActive} onClick={() => setMode("renew-membership")}>
              {membershipActive ? "Membership still running" : membership ? "Renew membership" : "Start a membership"}
            </Button>
            <Button fullWidth style={{ marginTop: 8 }} disabled={packageActive} onClick={() => setMode("renew-package")}>
              {packageActive ? "Package still running" : pkg ? "Renew package" : "Sell a package"}
            </Button>
            <Button variant="secondary" fullWidth style={{ marginTop: 8 }} disabled={packageActive} onClick={() => setMode("assign")}>
              {packageActive ? "Coach locked mid-package" : coachName ? "Change coach" : "Assign a coach"}
            </Button>
            <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={() => setMode("invite")}>
              {shown.email ? "Re-invite to app" : "Invite to app"}
            </Button>
            <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose}>
              Close
            </Button>
          </>
        ) : (
          <>
            <SheetHeading
              kicker={shown.name.toUpperCase()}
              title={mode === "assign" ? "Assign a coach" : mode === "invite" ? "Invite to app" : mode === "renew-membership" ? "Choose membership" : "Choose package"}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {mode === "invite" && (
                <>
                  <TextField label="EMAIL" value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" placeholder="member@email.com" />
                  <div style={{ font: "400 12px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
                    They'll use this email to sign in to the branded member app.
                  </div>
                </>
              )}
              {mode === "renew-membership" && (
                <SelectField
                  label="MEMBERSHIP"
                  value={pickId}
                  onChange={setPickId}
                  placeholder={membershipTypes.length ? "Choose a membership" : "No memberships set up yet"}
                  disabled={membershipTypes.length === 0}
                  options={membershipOptions(membershipTypes)}
                />
              )}
              {mode === "renew-package" && <SelectField label="PACKAGE" value={pickId} onChange={setPickId} placeholder="Choose a package" options={bundleOptions(bundleTypes)} />}
              {(mode === "renew-package" || mode === "assign") && (
                <SelectField label="COACH" value={coachId} onChange={setCoachId} placeholder="Choose a coach" options={coachOptions(coaches)} />
              )}
            </div>
            {error && <ErrorBanner text={error} />}
            <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={confirmMode}>
              {busy ? "Saving…" : mode === "assign" ? "Assign coach" : mode === "invite" ? "Send invitation" : mode === "renew-membership" ? "Start membership" : "Sell package"}
            </Button>
            <Button
              variant="secondary"
              fullWidth
              style={{ marginTop: 8 }}
              disabled={busy}
              onClick={() => {
                setMode("view");
                setError(null);
              }}
            >
              Back
            </Button>
          </>
        )}
      </Sheet>
    </>
  );
}

function PlanCard({ label, title, tone, lines }: { label: string; title: string; tone: "active" | "expired" | "none" | null; lines: string[] }) {
  return (
    <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", flex: 1 }}>{label}</div>
        {tone && <PlanPill tone={tone} />}
      </div>
      <div style={{ font: "700 16px var(--font-body)", marginTop: 4 }}>{title}</div>
      {lines.map((l) => (
        <div key={l} style={{ font: "400 13px var(--font-mono)", color: "var(--ink-muted)" }}>
          {l}
        </div>
      ))}
    </div>
  );
}

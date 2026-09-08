import { useEffect, useState } from "react";
import { useSetHeader } from "../lib/header";
import { useAsync } from "../lib/useAsync";
import { api } from "../lib/backend";
import type { Invite, Profile, Role, Tier } from "../lib/types";
import { ROLE_LABELS } from "../lib/types";
import { Segmented } from "../components/Segmented";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { Sheet } from "../components/Sheet";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { TextField, SelectField } from "../components/FormField";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../lib/auth";

type Tab = "tiers" | "invites" | "people";

export function Manage() {
  const [tab, setTab] = useState<Tab>("tiers");

  useSetHeader(
    {
      kicker: "MANAGE",
      title: "Tiers & People",
      right: (
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "tiers", label: "TIERS" },
            { value: "invites", label: "INVITES" },
            { value: "people", label: "PEOPLE" },
          ]}
        />
      ),
    },
    [tab],
  );

  if (tab === "tiers") return <TiersPanel />;
  if (tab === "invites") return <InvitesPanel />;
  return <PeoplePanel />;
}

// ---------- Tiers ----------

function TiersPanel() {
  const { data, loading, refetch } = useAsync(() => api.tiers(), []);
  const [editing, setEditing] = useState<Tier | "new" | null>(null);
  const [deleting, setDeleting] = useState<Tier | null>(null);

  if (loading || !data) return null;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Tiers</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{data.tiers.length}</span>
        <Button size="md" style={{ marginLeft: "auto", height: 40, padding: "0 16px" }} onClick={() => setEditing("new")}>
          + New tier
        </Button>
      </div>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
        {data.tiers.map((t, i) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: i === data.tiers.length - 1 ? "none" : "1px solid var(--line)" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 16px var(--font-body)" }}>{t.name}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{t.rate} EGP / session</div>
            </div>
            <button onClick={() => setEditing(t)} aria-label="Edit tier" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: "var(--primary-tint)", color: "var(--primary-pressed)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="pencil" size={15} />
            </button>
            <button onClick={() => setDeleting(t)} aria-label="Delete tier" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: "var(--danger-bg)", color: "var(--danger-fg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        {data.tiers.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>No tiers yet.</div>}
      </div>

      <TierSheet open={editing !== null} tier={editing === "new" ? null : editing} onClose={() => setEditing(null)} onSaved={refetch} />
      {deleting && (
        <ConfirmSheet
          open={!!deleting}
          onClose={() => setDeleting(null)}
          kicker="DELETE TIER"
          title={`Delete ${deleting.name}?`}
          sub="Coaches on this tier will need a new one assigned."
          confirmLabel="Delete tier"
          danger
          onConfirm={async () => {
            await api.deleteTier(deleting.id);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function TierSheet({ open, tier, onClose, onSaved }: { open: boolean; tier: Tier | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(tier?.name ?? "");
  const [rate, setRate] = useState(String(tier?.rate ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName(tier?.name ?? "");
      setRate(String(tier?.rate ?? ""));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tier]);

  if (!open) return null;

  const save = async () => {
    const rateNum = Number(rate);
    if (!name.trim() || !Number.isFinite(rateNum) || rateNum <= 0) {
      setError("Enter a name and a rate greater than 0.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (tier) await api.updateTier(tier.id, name.trim(), rateNum);
      else await api.createTier(name.trim(), rateNum);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{tier ? "EDIT TIER" : "NEW TIER"}</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{tier ? tier.name : "New tier"}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tier 2 · Intermediate" />
        <TextField label="RATE · EGP / SESSION" type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} />
      </div>
      {error && (
        <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
          {error}
        </div>
      )}
      <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
        {busy ? "Saving…" : tier ? "Save changes" : "Create tier"}
      </Button>
      <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
        Cancel
      </Button>
    </Sheet>
  );
}

// ---------- Invites ----------

const INVITABLE_ROLES: Role[] = ["coach", "head_coach", "dept_head", "accountant"];

function InvitesPanel() {
  const { data, loading, refetch } = useAsync(() => api.invites(), []);
  const { data: tierData } = useAsync(() => api.tiers(), []);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<Invite | null>(null);

  if (loading || !data) return null;
  const tiers = tierData?.tiers ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Pending invites</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{data.invites.length}</span>
        <Button size="md" style={{ marginLeft: "auto", height: 40, padding: "0 16px" }} onClick={() => setOpen(true)}>
          + Invite
        </Button>
      </div>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
        {data.invites.map((inv, i) => (
          <div key={inv.email} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: i === data.invites.length - 1 ? "none" : "1px solid var(--line)" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 16px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inv.email}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
                {ROLE_LABELS[inv.role].toUpperCase()}
                {inv.tierId ? ` · ${tiers.find((t) => t.id === inv.tierId)?.name ?? ""}` : ""}
              </div>
            </div>
            <button onClick={() => setDeleting(inv)} aria-label="Cancel invite" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: "var(--danger-bg)", color: "var(--danger-fg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        {data.invites.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--ink-faint)", font: "500 14px var(--font-body)" }}>No pending invites.</div>}
      </div>

      <InviteSheet open={open} tiers={tiers} onClose={() => setOpen(false)} onSaved={refetch} />
      {deleting && (
        <ConfirmSheet
          open={!!deleting}
          onClose={() => setDeleting(null)}
          kicker="CANCEL INVITE"
          title={`Cancel invite for ${deleting.email}?`}
          confirmLabel="Cancel invite"
          danger
          onConfirm={async () => {
            await api.deleteInvite(deleting.email);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function InviteSheet({ open, tiers, onClose, onSaved }: { open: boolean; tiers: Tier[]; onClose: () => void; onSaved: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("coach");
  const [tierId, setTierId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setEmail("");
      setRole("coach");
      setTierId("");
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const save = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.createInvite(email.trim(), role, role === "accountant" ? null : tierId || null);
      onSaved();
      onClose();
      setEmail("");
      setTierId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>NEW INVITE</div>
      <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>Invite someone</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <TextField label="EMAIL" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@bizqwik.app" />
        <SelectField
          label="ROLE"
          value={role}
          onChange={(v) => setRole(v as Role)}
          options={INVITABLE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))}
        />
        {role !== "accountant" && (
          <SelectField
            label="TIER"
            value={tierId}
            onChange={setTierId}
            options={[{ value: "", label: "No tier yet" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]}
          />
        )}
      </div>
      {error && (
        <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
          {error}
        </div>
      )}
      <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
        {busy ? "Sending…" : "Send invite"}
      </Button>
      <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
        Cancel
      </Button>
    </Sheet>
  );
}

// ---------- People ----------

function PeoplePanel() {
  const { profile: me } = useAuth();
  const { data, loading, refetch } = useAsync(() => api.profiles(), []);
  const { data: tierData } = useAsync(() => api.tiers(), []);
  const [editing, setEditing] = useState<Profile | null>(null);

  if (loading || !data) return null;
  const tiers = tierData?.tiers ?? [];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>People</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{data.profiles.length}</span>
      </div>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
        {data.profiles.map((p, i) => (
          <button
            key={p.id}
            onClick={() => setEditing(p)}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px", borderBottom: i === data.profiles.length - 1 ? "none" : "1px solid var(--line)", width: "100%", border: 0, background: "none", cursor: "pointer", textAlign: "left" }}
        >
            <Avatar name={p.name} size={36} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 16px var(--font-body)" }}>{p.name}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>
                {ROLE_LABELS[p.role].toUpperCase()}
                {p.tierId ? ` · ${tiers.find((t) => t.id === p.tierId)?.name ?? ""}` : ""}
              </div>
            </div>
            <Icon name="chevron-right" size={16} />
          </button>
        ))}
      </div>

      <PersonSheet open={!!editing} profile={editing} tiers={tiers} isSelf={editing?.id === me?.id} onClose={() => setEditing(null)} onSaved={refetch} />
    </div>
  );
}

function PersonSheet({
  open,
  profile,
  tiers,
  isSelf,
  onClose,
  onSaved,
}: {
  open: boolean;
  profile: Profile | null;
  tiers: Tier[];
  isSelf?: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tierId, setTierId] = useState(profile?.tierId ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && profile) {
      setTierId(profile.tierId ?? "");
      setConfirmRemove(false);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, profile]);

  if (!open || !profile) return null;

  const saveTier = async (value: string) => {
    setTierId(value);
    setBusy(true);
    setError(null);
    try {
      await api.assignTier(profile.id, value || null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={open} onClose={onClose}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <Avatar name={profile.name} size={44} />
          <div>
            <div style={{ font: "800 22px var(--font-body)", letterSpacing: "-.01em" }}>{profile.name}</div>
            <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{profile.email}</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div data-sq style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: "12px 16px" }}>
            <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>ROLE</div>
            <div style={{ font: "600 16px var(--font-body)" }}>{ROLE_LABELS[profile.role]}</div>
          </div>
          {profile.role !== "accountant" && (
            <SelectField
              label="TIER"
              value={tierId}
              onChange={saveTier}
              disabled={busy}
              options={[{ value: "", label: "Not assigned" }, ...tiers.map((t) => ({ value: t.id, label: t.name }))]}
            />
          )}
        </div>

        {error && (
          <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
            {error}
          </div>
        )}

        {!isSelf && (
          <Button variant="danger" fullWidth style={{ marginTop: 18 }} onClick={() => setConfirmRemove(true)}>
            Remove profile
          </Button>
        )}
        <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={onClose}>
          Close
        </Button>
      </Sheet>

      <ConfirmSheet
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        kicker="REMOVE PROFILE"
        title={`Remove ${profile.name}?`}
        sub="They'll lose access to Bizqwik immediately. Their past records stay in the ledger."
        confirmLabel="Remove profile"
        danger
        onConfirm={async () => {
          await api.removeProfile(profile.id);
          onSaved();
          onClose();
        }}
      />
    </>
  );
}

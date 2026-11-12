import { useFrozen, useMountedThroughExit } from "../../lib/useLatch";
import { EmptyState } from "../../components/EmptyState";
import { useEffect, useState } from "react";
import { useAsync } from "../../lib/useAsync";
import { useLatch } from "../../lib/useLatch";
import { api } from "../../lib/backend";
import type { Tier } from "../../lib/types";
import { ROLE_LABELS } from "../../lib/types";
import { Button } from "../../components/Button";
import { Icon } from "../../components/Icon";
import { Sheet } from "../../components/Sheet";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { TextField } from "../../components/FormField";
import { Spinner } from "../../components/Spinner";
import { SheetSuccessIcon } from "../../components/SheetSuccessIcon";
import { useSheetSuccess } from "../../lib/useSheetSuccess";

export function TiersPanel({ onOpenPeople, onOpenInvites }: { onOpenPeople: () => void; onOpenInvites: () => void }) {
  const { data } = useAsync(() => api.tiers(), []);
  // Who is on a tier decides whether it can be deleted, so know it up front.
  const { data: peopleData } = useAsync(() => api.profiles(), []);
  const { data: inviteData } = useAsync(() => api.invites(), []);
  const onTier = (id?: string) => (peopleData?.profiles ?? []).filter((p) => !!id && p.tierId === id);
  const invitedTo = (id?: string) => (inviteData?.invites ?? []).filter((i) => !!id && i.tierId === id);
  const [editing, setEditing] = useState<Tier | "new" | null>(null);
  const [deleting, setDeleting] = useState<Tier | null>(null);
  const shownDeleting = useLatch(deleting);

  if (!data) return <Spinner />;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ font: "700 20px var(--font-body)", letterSpacing: "-.01em" }}>Tiers</span>
        <span style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{data.tiers.length}</span>
        <Button size="md" style={{ marginLeft: "auto", height: 40, padding: "0 16px" }} onClick={() => setEditing("new")}>
          + New tier
        </Button>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", overflow: "hidden" }}>
        {data.tiers.map((t, i) => (
          <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px", borderBottom: i === data.tiers.length - 1 ? "none" : "1px solid var(--line)" }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ font: "700 16px var(--font-body)" }}>{t.name}</div>
              <div style={{ font: "400 13px var(--font-mono)", color: "var(--ink-faint)" }}>{t.rate} EGP / session · {t.privateCutPct}% private cut</div>
            </div>
            <button className="bq-hit" onClick={() => setEditing(t)} aria-label="Edit tier" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: "var(--primary-tint)", color: "var(--primary-pressed)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="pencil" size={15} />
            </button>
            <button className="bq-hit" onClick={() => setDeleting(t)} aria-label="Delete tier" style={{ width: 36, height: 36, borderRadius: 999, border: 0, background: "var(--danger-bg)", color: "var(--danger-fg)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="trash" size={15} />
            </button>
          </div>
        ))}
        {data.tiers.length === 0 && (
          <EmptyState bare icon="tag" title="No pay tiers yet" body="A tier sets what a coach earns per group session and their cut of PT sales. Create one, then assign it to coaches in People." action={{ label: "+ New tier", onClick: () => setEditing("new") }} />
        )}
      </div>

      <TierSheet open={editing !== null} tier={editing === "new" ? null : editing} onClose={() => setEditing(null)} />
      {shownDeleting && (onTier(shownDeleting.id).length > 0 || invitedTo(shownDeleting.id).length > 0) ? (
        <Sheet open={!!deleting} onClose={() => setDeleting(null)}>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>DELETE TIER</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 4px" }}>{shownDeleting.name} is still in use</div>
          <div style={{ font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-muted)", marginBottom: 14 }}>Move these to another tier first, then delete it.</div>
          <div style={{ background: "var(--sunken)", borderRadius: "var(--r-input)", padding: "6px 16px", marginBottom: 16 }}>
            {onTier(shownDeleting.id).map((p) => (
              <div key={p.id} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 0" }}>
                <span style={{ font: "700 15px var(--font-body)" }}>{p.name}</span>
                <span style={{ marginLeft: "auto", font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>{ROLE_LABELS[p.role]}</span>
              </div>
            ))}
            {invitedTo(shownDeleting.id).map((i) => (
              <div key={i.email} style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "10px 0" }}>
                <span style={{ font: "700 15px var(--font-body)", overflow: "hidden", textOverflow: "ellipsis" }}>{i.email}</span>
                <span style={{ marginLeft: "auto", font: "400 12px var(--font-mono)", color: "var(--ink-faint)" }}>Pending invite</span>
              </div>
            ))}
          </div>
          <Button
            fullWidth
            size="lg"
            onClick={() => {
              const hasPeople = onTier(shownDeleting.id).length > 0;
              setDeleting(null);
              if (hasPeople) onOpenPeople();
              else onOpenInvites();
            }}
          >
            {onTier(shownDeleting.id).length > 0 ? "Change their tier in People" : "Go to pending invites"}
          </Button>
          <Button variant="quiet" fullWidth style={{ marginTop: 8 }} onClick={() => setDeleting(null)}>
            Cancel
          </Button>
        </Sheet>
      ) : shownDeleting ? (
        <ConfirmSheet
          open={!!deleting}
          onClose={() => setDeleting(null)}
          kicker="DELETE TIER"
          title={`Delete ${shownDeleting.name}?`}
          sub="Coaches on this tier will need a new one assigned."
          confirmLabel="Delete tier"
          danger
          onConfirm={async () => {
            await api.deleteTier(shownDeleting.id);
          }}
        />
      ) : null}
    </div>
  );
}

export function TierSheet({ open, tier: tierProp, onClose }: { open: boolean; tier: Tier | null; onClose: () => void }) {
  const mounted = useMountedThroughExit(open);
  const tier = useFrozen(open, tierProp);
  const [name, setName] = useState(tier?.name ?? "");
  const [rate, setRate] = useState(String(tier?.rate ?? ""));
  const [privateCutPct, setPrivateCutPct] = useState(String(tier?.privateCutPct ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { confirmed, iconIn, showSuccess } = useSheetSuccess(open, onClose, { quiet: true });

  useEffect(() => {
    if (open) {
      setName(tier?.name ?? "");
      setRate(String(tier?.rate ?? ""));
      setPrivateCutPct(String(tier?.privateCutPct ?? ""));
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tier]);

  if (!mounted) return null;

  const save = async () => {
    const rateNum = Number(rate);
    const cutNum = privateCutPct === "" ? 0 : Number(privateCutPct);
    if (!name.trim() || !Number.isFinite(rateNum) || rateNum <= 0) {
      setError("Enter a name and a rate greater than 0.");
      return;
    }
    if (!Number.isFinite(cutNum) || cutNum < 0 || cutNum > 100) {
      setError("Private cut % must be between 0 and 100.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (tier) await api.updateTier(tier.id, name.trim(), rateNum, cutNum);
      else await api.createTier(name.trim(), rateNum, cutNum);
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
        <SheetSuccessIcon label={tier ? "Tier updated" : "Tier created"} iconIn={iconIn} />
      ) : (
        <>
          <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)" }}>{tier ? "EDIT TIER" : "NEW TIER"}</div>
          <div style={{ font: "800 26px/1.2 var(--font-body)", letterSpacing: "-.02em", margin: "4px 0 16px" }}>{tier ? tier.name : "New tier"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <TextField label="NAME" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tier 2 · Intermediate" />
            <TextField label="RATE · EGP / SESSION" type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} />
            <TextField label="PRIVATE TRAINING CUT · %" type="number" min={0} max={100} value={privateCutPct} onChange={(e) => setPrivateCutPct(e.target.value)} placeholder="50" />
          </div>
          {error && (
            <div className="bq-rise" style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
              {error}
            </div>
          )}
          <Button fullWidth size="lg" style={{ marginTop: 16 }} disabled={busy} onClick={save}>
            {busy ? "Saving…" : tier ? "Save changes" : "Create tier"}
          </Button>
          <Button variant="secondary" fullWidth style={{ marginTop: 8 }} onClick={onClose} disabled={busy}>
            Cancel
          </Button>
        </>
      )}
    </Sheet>
  );
}

// ---------- Bundles (private training) ----------

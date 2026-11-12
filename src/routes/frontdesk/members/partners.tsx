import { useState } from "react";
import { useAsync } from "../../../lib/useAsync";
import { api, type SalePartner } from "../../../lib/backend";
import { fmt } from "../../../lib/format";
import type { ClassSeries, GroupPlanType } from "../../../lib/types";
import { atLocation, useCurrentLocation } from "../../../lib/locations";
import { Button } from "../../../components/Button";
import { TextField, SelectField } from "../../../components/FormField";
import { useAuth } from "../../../lib/auth";
import { ErrorBanner, SearchField } from "../shared";
import { matchesClient } from "../deskStatus";
import { groupOfferOptions } from "./offers";

// Who shares a shared bundle with the client being sold to: someone already on
// file or a brand-new client. Each person gets an even share of the classes and
// the price, and their own plan.
export function PartnerPicker({ type, buyerId, picked, onChange }: { type: GroupPlanType; buyerId: string | null; picked: SalePartner[]; onChange: (p: SalePartner[]) => void }) {
  const seats = type.sharedSeats!;
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [nName, setNName] = useState("");
  const [nPhone, setNPhone] = useState("");
  const [nEmail, setNEmail] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const { data } = useAsync(() => api.clients(), []);
  const all = data?.clients ?? [];
  const pickedIds = picked.flatMap((p) => ("clientId" in p ? [p.clientId] : []));
  const labelOf = (p: SalePartner) => ("clientId" in p ? (all.find((c) => c.id === p.clientId)?.name ?? "Client") : `${p.name} (new)`);
  const each = type.credits! / seats;
  const results = q.trim() ? all.filter((c) => c.id !== buyerId && !pickedIds.includes(c.id) && matchesClient(c, q)).slice(0, 5) : [];
  const addNew = () => {
    const mail = nEmail.trim().toLowerCase();
    if (!nName.trim() || !nPhone.trim()) return setErr("Name and phone number are required.");
    if (!/^\S+@\S+\.\S+$/.test(mail)) return setErr("Enter their email — they sign in to the app with it.");
    if (all.some((c) => (c.email ?? "").trim().toLowerCase() === mail)) return setErr("Another client already uses this email — search for them instead.");
    onChange([...picked, { name: nName.trim(), phone: nPhone.trim(), email: mail }]);
    setAdding(false);
    setNName("");
    setNPhone("");
    setNEmail("");
    setErr(null);
  };
  return (
    <div style={{ background: "var(--sunken)", border: "1px solid var(--line)", borderRadius: "var(--r-input)", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ font: "400 var(--fs-note)/1.5 var(--font-body)", color: "var(--ink-muted)" }}>
        Shared by {seats}: {each} classes and {fmt(type.price / seats)} EGP each, {type.durationMonths} months from today. Each person gets their own plan.
      </div>
      {picked.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, font: "700 var(--fs-body) var(--font-body)" }}>
          <span style={{ flex: 1 }}>{labelOf(p)}</span>
          <button className="bq-scale" onClick={() => onChange(picked.filter((_, j) => j !== i))} aria-label="Remove" style={{ border: 0, background: "none", color: "var(--ink-muted)", cursor: "pointer", font: "600 var(--fs-note) var(--font-body)" }}>Remove</button>
        </div>
      ))}
      {picked.length < seats - 1 && !adding && (
        <>
          <SearchField value={q} onChange={setQ} placeholder="Search the other client" />
          {results.map((c) => (
            <button key={c.id} className="bq-scale" onClick={() => { onChange([...picked, { clientId: c.id, label: c.name }]); setQ(""); }} style={{ textAlign: "left", minHeight: 44, border: 0, background: "none", cursor: "pointer", font: "600 var(--fs-body) var(--font-body)", color: "var(--ink)" }}>
              {c.name}
              {c.phone && <span className="bq-meta"> · {c.phone}</span>}
            </button>
          ))}
          <Button variant="secondary" onClick={() => setAdding(true)}>Add as a new client</Button>
        </>
      )}
      {adding && (
        <>
          <TextField label="FULL NAME" value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Client name" autoComplete="off" />
          <TextField label="PHONE" type="tel" value={nPhone} onChange={(e) => setNPhone(e.target.value)} placeholder="01xxxxxxxxx" autoComplete="off" />
          <TextField label="EMAIL" type="email" value={nEmail} onChange={(e) => setNEmail(e.target.value)} autoComplete="off" />
          {err && <ErrorBanner text={err} />}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="secondary" style={{ flex: 1 }} onClick={() => { setAdding(false); setErr(null); }}>Cancel</Button>
            <Button style={{ flex: 1 }} onClick={addNew}>Add client</Button>
          </div>
        </>
      )}
    </div>
  );
}

export function GroupOfferSelect({ value, onChange, planTypes, series }: { value: string; onChange: (v: string) => void; planTypes: GroupPlanType[]; series: ClassSeries[] }) {
  // Each location has its own prices: only what's sold where she's working.
  const { locations: offerLocations, current: offerHere } = useCurrentLocation();
  const at = offerLocations.length > 1 ? (offerHere?.id ?? null) : null;
  const options = groupOfferOptions(planTypes.filter((t) => atLocation(t.locationId, at)), series.filter((x) => atLocation(x.locationId, at)), offerLocations);
  const { profile, orgMode } = useAuth();
  // A solo owner with a couple of plans picks them as cards, not from a list.
  if (profile?.role === "dept_head" && orgMode === "solo" && options.length > 0 && options.length <= 6) {
    return (
      <div role="radiogroup" aria-label="Plan" className="bq-stack">
        {options.map((o) => {
          const [name, price, ...rest] = o.label.split(" · ");
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              className="bq-scale"
              onClick={() => onChange(o.value)}
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", cursor: "pointer", textAlign: "left", borderRadius: "var(--r-card)", border: on ? "2px solid var(--primary)" : "1px solid var(--line)", background: on ? "var(--primary-tint)" : "var(--surface)", color: "var(--ink)" }}
            >
              <span className="bq-grow">
                <span style={{ display: "block", font: "800 18px var(--font-body)", letterSpacing: "-.01em" }}>{name}</span>
                <span style={{ display: "block", font: "400 var(--fs-small) var(--font-mono)", color: "var(--ink-muted)", marginTop: 2 }}>{rest.join(" · ")}</span>
              </span>
              <span style={{ font: "800 18px var(--font-mono)", color: on ? "var(--primary-pressed)" : "var(--ink)" }}>{price}</span>
            </button>
          );
        })}
      </div>
    );
  }
  return (
    <>
      <SelectField
        label="GROUP PLAN"
        value={value}
        onChange={onChange}
        placeholder="Membership, class monthly or bundle"
        options={options}
        empty={{ title: "Nothing on sale yet", body: "The department head adds classes, memberships and class bundles in Catalog. They show up here to sell as soon as they're created." }}
      />
    </>
  );
}

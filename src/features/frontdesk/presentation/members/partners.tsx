import { useState } from "react";
import type { SalePartner } from "../../../../shared/api/backend";
import { useDeskClients } from "../hooks/useDesk";
import { fmt } from "../../../../shared/format";
import type { ClassSeries, GroupPlanType } from "../../../../shared/types";
import { atLocation, useCurrentLocation } from "../../../../shared/session/locations";
import { Button } from "../../../../design-system/components/Button";
import { TextField, SelectField } from "../../../../design-system/components/FormField";
import { useAuth } from "../../../../shared/session/auth";
import { SearchField } from "../shared";
import { ErrorBanner } from "../../../../design-system/components/ErrorBanner";
import { matchesClient } from "../../../../shared/domain/deskStatus";
import { groupOfferOptions } from "./offers";
import "./partners.css";

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
  const { data } = useDeskClients();
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
    <div className="bq-frontdesk-partners-partner-picker-stack">
      <div className="bq-frontdesk-partners-partner-picker-text">
        Shared by {seats}: {each} classes and {fmt(type.price / seats)} EGP each, {type.durationMonths} months from today. Each person gets their own plan.
      </div>
      {picked.map((p, i) => (
        <div className="bq-frontdesk-partners-partner-picker-title" key={i}>
          <span className="bq-flex-1">{labelOf(p)}</span>
          <button className="bq-scale bq-frontdesk-partners-partner-picker-btn" onClick={() => onChange(picked.filter((_, j) => j !== i))} aria-label="Remove">Remove</button>
        </div>
      ))}
      {picked.length < seats - 1 && !adding && (
        <>
          <SearchField value={q} onChange={setQ} placeholder="Search the other client" />
          {results.map((c) => (
            <button key={c.id} className="bq-scale bq-frontdesk-partners-partner-picker-btn-2" onClick={() => { onChange([...picked, { clientId: c.id, label: c.name }]); setQ(""); }}>
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
          <div className="bq-flex bq-gap-2">
            <Button className="bq-flex-1" variant="secondary" onClick={() => { setAdding(false); setErr(null); }}>Cancel</Button>
            <Button className="bq-flex-1" onClick={addNew}>Add client</Button>
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
              style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", cursor: "pointer", textAlign: "left", borderRadius: "var(--radius-card)", border: on ? "2px solid var(--color-bg-fill-primary-default)" : "1px solid var(--color-border-primary-default)", background: on ? "var(--color-bg-fill-accent-default)" : "var(--color-bg-surface-primary-default)", color: "var(--color-text-primary-default)" }}
            >
              <span className="bq-grow">
                <span className="bq-frontdesk-partners-group-offer-select-title">{name}</span>
                <span className="bq-frontdesk-partners-group-offer-select-meta">{rest.join(" · ")}</span>
              </span>
              <span className="bq-frontdesk-partners-group-offer-select-meta-2" style={{ color: on ? "var(--color-bg-fill-primary-active)" : "var(--color-text-primary-default)" }}>{price}</span>
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

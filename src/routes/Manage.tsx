import { useState } from "react";
import { useSetHeader } from "../lib/header";
import { Segmented } from "../components/Segmented";
import { TiersPanel } from "./manage/TiersPanel";
import { InvitesPanel } from "./manage/Invites";
import { PeoplePanel } from "./manage/People";
export { TierSheet } from "./manage/TiersPanel";
export { BundleSheet, BundlesPanel, NO_EXPIRY_DAYS } from "./manage/BundlesPanel";
export { InviteFlow } from "./manage/Invites";

type Tab = "tiers" | "invites" | "people";

export function Manage() {
  // Empty states elsewhere deep-link straight to a tab (?tab=invites).
  const initialTab = new URLSearchParams(window.location.search).get("tab");
  const [tab, setTab] = useState<Tab>(initialTab === "invites" || initialTab === "people" ? initialTab : "tiers");

  useSetHeader({ kicker: "MANAGE", title: "Team & Tiers" }, []);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "tiers", label: "TIERS" },
            { value: "invites", label: "INVITES" },
            { value: "people", label: "PEOPLE" },
          ]}
        />
      </div>
      {tab === "tiers" && <TiersPanel onOpenPeople={() => setTab("people")} onOpenInvites={() => setTab("invites")} />}
      {tab === "invites" && <InvitesPanel />}
      {tab === "people" && <PeoplePanel />}
    </div>
  );
}

// ---------- Tiers ----------

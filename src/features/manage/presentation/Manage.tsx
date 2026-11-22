import { useState } from "react";
import { useSetHeader } from "../../../shared/screen/header";
import { Segmented } from "../../../design-system/components/Segmented";
import { TiersPanel } from "./TiersPanel";
import { InvitesPanel } from "./Invites";
import { PeoplePanel } from "./People";
import { tabFromQuery, type ManageTab } from "../domain/team";

export function Manage() {
  // Empty states elsewhere deep-link straight to a tab (?tab=invites).
  const [tab, setTab] = useState<ManageTab>(() => tabFromQuery(window.location.search));

  useSetHeader({ kicker: "MANAGE", title: "Team & Tiers" }, []);

  return (
    <div>
      <div className="bq-flex bq-justify-center bq-mb-4">
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

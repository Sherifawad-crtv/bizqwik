import { useSticky } from "../lib/useSticky";
import { useSetHeader } from "../lib/header";
import { LocationSwitcher, useCurrentLocation } from "../lib/locations";
import { Segmented } from "../components/Segmented";
import { Spinner } from "../components/Spinner";
import { BundlesPanel } from "./Manage";
import { useAuth } from "../lib/auth";
import { ClassesPanel } from "./catalog/Classes";
import { PlansPanel } from "./catalog/Plans";
import { LocationsCard, SoloOffer } from "./catalog/Solo";
export { SeriesSheet } from "./catalog/Classes";
export { PlanTypeSheet } from "./catalog/Plans";

type Tab = "classes" | "plans" | "pt";

/** The founder's catalog: everything the gym sells. Group classes (recurring,
 * each with a drop-in and a monthly price), group plans (all-access
 * memberships and class bundles), and private-training bundles. */
export function Catalog() {
  const { orgMode } = useAuth();
  const solo = orgMode === "solo";
  // A solo owner opens on her plans; a team catalog on its classes.
  const [tab, setTab] = useSticky<Tab>("catalogTab", solo ? "plans" : "classes", { valid: (v) => ["classes","plans","pt"].includes(v) });
  useSetHeader(solo ? { kicker: "WHAT YOU SELL", title: "Plans" } : { kicker: "WHAT YOU SELL", title: "Catalog" }, [solo]);
  const { ready: locsReady } = useCurrentLocation();

  return (
    <div>
      {solo && <LocationSwitcher />}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: "classes", label: "CLASSES" },
            { value: "plans", label: "PLANS" },
            { value: "pt", label: "PT BUNDLES" },
          ]}
        />
      </div>
      {!locsReady ? (
        <Spinner />
      ) : (
        <div key={tab} className="bq-rise">
          {tab === "classes" && <ClassesPanel solo={solo} />}
          {tab === "plans" && (solo ? (<div><LocationsCard /><SoloOffer /><PlansPanel solo /></div>) : <PlansPanel />)}
          {tab === "pt" && <BundlesPanel />}
        </div>
      )}
    </div>
  );
}

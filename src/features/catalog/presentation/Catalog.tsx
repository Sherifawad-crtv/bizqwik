import { useSticky } from "../../../design-system/hooks/useSticky";
import { useSetHeader } from "../../../shared/screen/header";
import { LocationSwitcher, useCurrentLocation } from "../../../shared/locations";
import { Segmented } from "../../../design-system/components/Segmented";
import { Spinner } from "../../../design-system/components/Spinner";
import { BundlesPanel } from "./BundlesPanel";
import { useAuth } from "../../../shared/auth";
import { ClassesPanel } from "./Classes";
import { PlansPanel } from "./Plans";
import { LocationsCard, SoloOffer } from "./Solo";

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
      <div className="bq-flex bq-justify-center bq-mb-4">
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

import { useState, type ReactNode } from "react";
import { useAsync } from "../../lib/useAsync";
import { api } from "../../lib/backend";
import { CreateClientSheet, useFrontDeskCatalog, useSellableCoaches } from "./Members";

/** The new-client flow, with what it needs loaded only while it's open. */
export function NewClientModal({ onClose }: { onClose: () => void }) {
  const { data } = useAsync(() => api.clients(), []);
  const coaches = useSellableCoaches();
  const { planTypes, series, bundleTypes } = useFrontDeskCatalog();
  return (
    <CreateClientSheet open onClose={onClose} takenEmails={(data?.clients ?? []).map((c) => c.email ?? "")} planTypes={planTypes} series={series} bundleTypes={bundleTypes} coaches={coaches} />
  );
}

/** For a screen that can be reached on its own (not inside the Home modals):
 * `open()` puts the new-client flow over the screen instead of sending the
 * desk to the Clients page. Render `modal` once anywhere in the screen. */
export function useNewClient(): { open: () => void; modal: ReactNode } {
  const [on, setOn] = useState(false);
  return { open: () => setOn(true), modal: on ? <NewClientModal onClose={() => setOn(false)} /> : null };
}

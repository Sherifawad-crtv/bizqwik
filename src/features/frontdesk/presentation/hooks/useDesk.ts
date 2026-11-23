import { useAsync } from "../../../../shared/api/useAsync";
import { frontdeskRepository as repo } from "../../data/frontdeskRepository";

/** The client list. Screens that show it at the same moment share one request. */
export const useDeskClients = () => useAsync(() => repo.clients(), []);

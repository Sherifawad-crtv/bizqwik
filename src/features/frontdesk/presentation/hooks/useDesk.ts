import { useAsync } from "../../../../shared/api/useAsync";
import { frontdeskRepository } from "../../data/frontdeskRepository";

/** The desk screens' only way to the server: every read and write goes
 * through here to the data layer (frontdeskRepository). */
export const desk = frontdeskRepository;

/** The client list. Screens that show it at the same moment share one request. */
export const useDeskClients = () => useAsync(() => desk.clients(), []);

import { useAsync } from "../../../../shared/api/useAsync";
import { classesRepository as repo } from "../../data/classesRepository";

export const useSessions = () => useAsync(() => repo.classes(), []);
export const cancelSession = (id: string) => repo.cancelClass(id);

import { useSave } from "../../../../shared/api/useSave";
import { clientsRepository } from "../../data/clientsRepository";
import { checkClientEdit, checkCompensation } from "../../domain/roster";

export function useCompensateClient(clientId: string) {
  const { busy, error, setError, run } = useSave();
  const compensate = async (amountText: string, noteText: string): Promise<boolean> => {
    const checked = checkCompensation(amountText, noteText);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    return run(() => clientsRepository.compensate(clientId, checked.value.amount, checked.value.note));
  };
  return { compensate, busy, error, setError };
}

export function useEditClient(clientId: string) {
  const { busy, error, setError, run } = useSave();
  const save = async (name: string, ageText: string, conditions: string): Promise<boolean> => {
    const checked = checkClientEdit(name, ageText, conditions);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    return run(() => clientsRepository.update(clientId, checked.value.name, checked.value.age, checked.value.conditions));
  };
  return { save, busy, error, setError };
}

export const deleteClient = (id: string) => clientsRepository.remove(id);

import { useSave } from "../../../../shared/api/useSave";
import { checkNewPassword } from "../../../../shared/passwordRules";
import { accountRepository as repo } from "../../data/accountRepository";
import { checkName } from "../../domain/profile";

/** Rename yourself. Resolves to true when it saved; `refresh` reloads the profile. */
export function useRename(refresh: () => Promise<unknown>) {
  const { busy, error, setError, run } = useSave();
  const save = async (name: string): Promise<boolean> => {
    const checked = checkName(name);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    return run(async () => {
      await repo.updateName(checked.value);
      await refresh();
    });
  };
  return { save, busy, error };
}

/** Upload or remove your photo, then reload the profile. */
export function usePhoto(userId: string, refresh: () => Promise<unknown>) {
  const { busy, error, run } = useSave();
  return {
    busy,
    error,
    upload: (makeBlob: () => Promise<Blob>) =>
      run(async () => {
        const url = await repo.uploadAvatar(userId, await makeBlob());
        await repo.updateAvatar(url);
        await refresh();
      }, { fallback: "Couldn't upload that photo." }),
    remove: () =>
      run(async () => {
        await repo.updateAvatar(null);
        await refresh();
      }),
  };
}

/** Change your password after re-checking the current one. Resolves to true when it changed. */
export function useChangePassword(email: string) {
  const { busy, error, setError, run } = useSave();
  const change = async (current: string, next: string, confirm: string): Promise<boolean> => {
    setError(null);
    const checked = checkNewPassword(next, confirm, "New password", "New passwords");
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    // Re-verify the current password before changing anything — the update
    // itself only needs the active session, but confirming first stops
    // anyone with a briefly-unlocked device from silently taking over.
    return run(async () => {
      await repo.signInWithPassword(email, current);
      await repo.updatePassword(next);
    });
  };
  return { change, busy, error };
}

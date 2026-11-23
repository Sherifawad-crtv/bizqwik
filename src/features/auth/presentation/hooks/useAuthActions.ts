import { useSave } from "../../../../shared/api/useSave";
import { checkNewPassword, checkPasswordLength } from "../../../../shared/passwordRules";
import { authRepository as repo } from "../../data/authRepository";

/** Create an account, then sign in with it (sign-up doesn't start a session). */
export function useSignup(login: (email: string, password: string) => Promise<void>) {
  const { busy, error, setError, run } = useSave();
  const signup = async (name: string, email: string, password: string) => {
    setError(null);
    const checked = checkPasswordLength(password);
    if (!checked.ok) return setError(checked.error);
    // The backend only creates the account if this email has a pending
    // invite (or is the very first account ever) — otherwise it rejects
    // with "You're not part of this organization."
    await run(async () => {
      await repo.signup(name.trim(), email.trim(), password);
      await login(email.trim(), password);
    });
  };
  return { signup, busy, error };
}

/** Email a password-reset link. Resolves to true when it was sent. */
export function usePasswordReset() {
  const { busy, error, run } = useSave();
  return { send: (email: string) => run(() => repo.sendPasswordReset(email)), busy, error };
}

/** Set a new password from the reset link. Resolves to true when it was saved. */
export function useNewPassword() {
  const { busy, error, setError, run } = useSave();
  const save = async (password: string, confirm: string): Promise<boolean> => {
    setError(null);
    const checked = checkNewPassword(password, confirm);
    if (!checked.ok) {
      setError(checked.error);
      return false;
    }
    return run(() => repo.updatePassword(password));
  };
  return { save, busy, error };
}

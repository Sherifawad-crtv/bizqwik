// Password rules shared by sign-up, reset and change-password. Pure: no React,
// no server calls.

export const MIN_PASSWORD_LENGTH = 8;

type Checked = { ok: true } | { ok: false; error: string };

/** Long enough. `label` names the field in the message ("Password", "New password"). */
export function checkPasswordLength(password: string, label = "Password"): Checked {
  return password.length < MIN_PASSWORD_LENGTH ? { ok: false, error: `${label} must be at least ${MIN_PASSWORD_LENGTH} characters.` } : { ok: true };
}

/** Long enough and typed the same twice. `plural` names both fields ("Passwords", "New passwords"). */
export function checkNewPassword(password: string, confirm: string, label = "Password", plural = "Passwords"): Checked {
  const length = checkPasswordLength(password, label);
  if (!length.ok) return length;
  return password !== confirm ? { ok: false, error: `${plural} don't match.` } : { ok: true };
}

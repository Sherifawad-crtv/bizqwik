import { cx } from "../../design-system/cx";
import { useEffect, useState } from "react";
import { SwitchVisual } from "../../design-system/components/Switch";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/auth";
import { useSetHeader } from "../../shared/screen/header";
import { Avatar } from "../../design-system/components/Avatar";
import { Button } from "../../design-system/components/Button";
import { Icon, type IconName } from "../../design-system/components/Icon";
import { ROLE_LABELS } from "../../shared/types";
import { cachedPushOn, disablePush, enablePush, isIOS, isStandalone, primePushState, pushSupported, syncPushSubscriptionInBackground } from "../../shared/push";
import "./Account.css";

export function Account() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();

  useSetHeader({ kicker: "ACCOUNT", title: "Account" }, []);

  if (!profile) return null;

  const doLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div>
      <div className="bq-account-account-stack">
        <Avatar name={profile.name} size={120} src={profile.avatarUrl} />
        <div className="bq-account-account-title">{profile.name}</div>
        <div className="bq-account-account-text">{ROLE_LABELS[profile.role]}</div>
      </div>

      <div className="bq-card bq-account-account-spacing">
        <NotificationsRow />
        <SettingsRow icon="account" label="Account Settings" onClick={() => navigate("/account/profile")} />
        <SettingsRow icon="lock" label="Password Settings" onClick={() => navigate("/account/password")} last />
      </div>

      <Button className="bq-gap-10px" variant="danger" fullWidth size="lg" onClick={doLogout}>
        <Icon name="logout" size={18} /> Sign out
      </Button>
    </div>
  );
}

function NotificationsRow() {
  // Seeded from the cross-screen cache (populated at login, or by a
  // previous visit to this row) so a remount — which happens every time you
  // navigate away from Account and back — renders the correct state on its
  // very first paint instead of the switch's default and then flipping.
  const [on, setOn] = useState(cachedPushOn);
  // The switch's slide transition stays off until a frame after mount, so
  // if this row's own state-correcting check (below) does change `on`, that
  // correction itself never animates — only a later, real user tap does.
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const ios = isIOS();
  const standalone = isStandalone();
  const needsHomeScreenInstall = ios && !standalone && !pushSupported();
  // Installed and opened from the Home Screen, but Push still isn't there —
  // iOS only gained Web Push support in 16.4, so this is an old-OS case, not
  // a "go install it" case; needs its own message rather than falling
  // through to the silent `if (!supported) return null` below.
  const iosVersionTooOld = ios && standalone && !pushSupported();

  useEffect(() => {
    if (!pushSupported()) {
      setSupported(false);
      return;
    }
    primePushState().then((sub) => setOn(!!sub));
    // Re-registers this device's subscription under whoever's signed in
    // right now — fired in the background, not gating the toggle's state
    // above.
    syncPushSubscriptionInBackground();

    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  const toggle = async () => {
    if (busy) return;
    // The switch moves the moment you tap; it goes back only if turning it on
    // or off didn't work (permission refused, offline).
    const next = !on;
    setOn(next);
    setBusy(true);
    setError(null);
    try {
      if (next) await enablePush();
      else await disablePush();
    } catch (err) {
      setOn(!next);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  if (needsHomeScreenInstall || iosVersionTooOld) {
    return (
      <div className="bq-account-account-notifications-row-part">
        <div className="bq-account-account-notifications-row-text">
          <span className="bq-flex-none bq-flex bq-fg-secondary">
            <Icon name="bell" size={19} />
          </span>
          Push Notifications
        </div>
        <div className="bq-account-account-notifications-row-text-2">
          {iosVersionTooOld
            ? "Notifications need iOS/iPadOS 16.4 or later — update to enable this."
            : "On iPhone/iPad, add Bizqwik to your Home Screen first (Share → Add to Home Screen), then open it from there to turn this on."}
        </div>
      </div>
    );
  }

  if (!supported) return null;

  return (
    <div className="bq-account-account-notifications-row-part-2">
      <button className="bq-account-account-notifications-row-btn"
        onClick={toggle}
        role="switch"
        aria-checked={on}
      >
        <span className="bq-flex-none bq-flex bq-fg-secondary">
          <Icon name="bell" size={19} />
        </span>
        <span className="bq-flex-1">Push Notifications</span>
        <SwitchVisual checked={on} animate={ready} busy={busy} />
      </button>
      {error && (
        <div className="bq-account-account-notifications-row-text-3">
          {error}
        </div>
      )}
    </div>
  );
}

function SettingsRow({ icon, label, onClick, last }: { icon: IconName; label: string; onClick: () => void; last?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(`bq-plain bq-listrow bq-listrow--compact ${!(last) ? "bq-listrow--divider" : ""}`, "bq-account-account-settings-row-btn")}
    >
      <span className="bq-flex-none bq-flex bq-fg-secondary">
        <Icon name={icon} size={19} />
      </span>
      {label}
    </button>
  );
}

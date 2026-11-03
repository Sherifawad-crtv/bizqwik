import { useEffect, useState } from "react";
import { SwitchVisual } from "../components/Switch";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { ROLE_LABELS } from "../lib/types";
import { cachedPushOn, disablePush, enablePush, isIOS, isStandalone, primePushState, pushSupported, syncPushSubscriptionInBackground } from "../lib/push";

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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "24px 0 28px" }}>
        <Avatar name={profile.name} size={120} src={profile.avatarUrl} />
        <div style={{ font: "800 24px var(--font-body)", letterSpacing: "-.01em", marginTop: 12 }}>{profile.name}</div>
        <div style={{ font: "600 14px var(--font-body)", color: "var(--ink-faint)" }}>{ROLE_LABELS[profile.role]}</div>
      </div>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "6px 4px", marginBottom: 16 }}>
        <NotificationsRow />
        <SettingsRow icon="account" label="Account Settings" onClick={() => navigate("/account/profile")} />
        <SettingsRow icon="lock" label="Password Settings" onClick={() => navigate("/account/password")} last />
      </div>

      <Button variant="danger" fullWidth size="lg" onClick={doLogout} style={{ gap: 10 }}>
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
      <div style={{ borderBottom: "1px solid var(--line)", padding: "14px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, font: "600 15px var(--font-body)", color: "var(--ink)" }}>
          <span style={{ flex: "none", display: "flex", color: "var(--ink-muted)" }}>
            <Icon name="bell" size={19} />
          </span>
          Push Notifications
        </div>
        <div style={{ marginTop: 6, marginLeft: 31, font: "500 13px/1.5 var(--font-body)", color: "var(--ink-muted)" }}>
          {iosVersionTooOld
            ? "Notifications need iOS/iPadOS 16.4 or later — update to enable this."
            : "On iPhone/iPad, add Bizqwik to your Home Screen first (Share → Add to Home Screen), then open it from there to turn this on."}
        </div>
      </div>
    );
  }

  if (!supported) return null;

  return (
    <div style={{ borderBottom: "1px solid var(--line)" }}>
      <button
        onClick={toggle}
        role="switch"
        aria-checked={on}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          border: 0,
          background: "none",
          cursor: "pointer",
          padding: "14px 16px",
          font: "600 15px var(--font-body)",
          color: "var(--ink)",
          textAlign: "left",
        }}
      >
        <span style={{ flex: "none", display: "flex", color: "var(--ink-muted)" }}>
          <Icon name="bell" size={19} />
        </span>
        <span style={{ flex: 1 }}>Push Notifications</span>
        <SwitchVisual checked={on} animate={ready} busy={busy} />
      </button>
      {error && (
        <div style={{ margin: "0 16px 12px", font: "600 12px/1.4 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 10, padding: "8px 10px" }}>
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
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        width: "100%",
        border: 0,
        background: "none",
        cursor: "pointer",
        padding: "14px 16px",
        font: "600 15px var(--font-body)",
        color: "var(--ink)",
        textAlign: "left",
        borderBottom: last ? "none" : "1px solid var(--line)",
      }}
    >
      <span style={{ flex: "none", display: "flex", color: "var(--ink-muted)" }}>
        <Icon name={icon} size={19} />
      </span>
      {label}
    </button>
  );
}

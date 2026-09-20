import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { ROLE_LABELS } from "../lib/types";
import { currentPushSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupported, syncPushSubscriptionInBackground } from "../lib/push";

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
  const [on, setOn] = useState(false);
  // Guards the switch's slide animation from playing on mount — without it,
  // the initial on/off read (however fast) still lands one render after the
  // default `false`, and the CSS transition turns that into a visible flip
  // the instant the screen opens. Once the real state is known, later
  // transitions are real user-initiated toggles and should animate.
  const [initialized, setInitialized] = useState(false);
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
    currentPushSubscription().then((sub) => {
      setOn(!!sub);
      setInitialized(true);
    });
    // Re-registers this device's subscription under whoever's signed in
    // right now — fired in the background, not gating the toggle's state
    // above (that's what used to cause the flicker).
    syncPushSubscriptionInBackground();
  }, []);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (on) {
        await disablePush();
        setOn(false);
      } else {
        await enablePush();
        setOn(true);
      }
    } catch (err) {
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
        disabled={busy}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          border: 0,
          background: "none",
          cursor: busy ? "default" : "pointer",
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
        <span
          aria-hidden
          style={{
            flex: "none",
            width: 44,
            height: 26,
            borderRadius: 999,
            background: on ? "var(--primary)" : "var(--sunken)",
            border: on ? "none" : "1px solid var(--line)",
            position: "relative",
            transition: initialized ? "background .2s ease" : "none",
            opacity: busy ? 0.6 : 1,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 2,
              left: on ? 21 : 2,
              width: 21,
              height: 21,
              borderRadius: 999,
              background: "var(--surface)",
              boxShadow: "0 1px 3px rgba(0,0,0,.25)",
              transition: initialized ? "left .2s ease" : "none",
            }}
          />
        </span>
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

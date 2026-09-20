import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon, type IconName } from "../components/Icon";
import { ROLE_LABELS } from "../lib/types";
import { disablePush, enablePush, isIOS, isStandalone, pushSupported, syncPushSubscription } from "../lib/push";
import { api } from "../lib/backend";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [testBusy, setTestBusy] = useState(false);
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
    syncPushSubscription().then((sub) => setOn(!!sub));
  }, []);

  const toggle = async () => {
    setBusy(true);
    setError(null);
    setTestStatus(null);
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

  const sendTest = async () => {
    setTestBusy(true);
    setTestStatus(null);
    try {
      const { results } = await api.pushTest();
      const failed = results.filter((r) => !r.ok);
      setTestStatus(failed.length === 0 ? "Sent — check your notifications." : `Sent, but ${failed.length} of ${results.length} device(s) failed.`);
    } catch (err) {
      setTestStatus(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setTestBusy(false);
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
            transition: "background .2s ease",
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
              transition: "left .2s ease",
            }}
          />
        </span>
      </button>
      {error && (
        <div style={{ margin: "0 16px 12px", font: "600 12px/1.4 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 10, padding: "8px 10px" }}>
          {error}
        </div>
      )}
      {on && (
        <div style={{ padding: "0 16px 12px" }}>
          <button
            onClick={sendTest}
            disabled={testBusy}
            style={{ border: 0, background: "none", padding: 0, cursor: testBusy ? "default" : "pointer", font: "700 13px var(--font-body)", color: "var(--primary)" }}
          >
            {testBusy ? "Sending…" : "Send test notification"}
          </button>
          {testStatus && <div style={{ marginTop: 6, font: "500 12px/1.4 var(--font-body)", color: "var(--ink-muted)" }}>{testStatus}</div>}
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

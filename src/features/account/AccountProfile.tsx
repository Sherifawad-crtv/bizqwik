import { useRef, useState } from "react";
import { useAuth } from "../../shared/auth";
import { useSetHeader } from "../../shared/screen/header";
import { api } from "../../shared/api/backend";
import { supabase } from "../../shared/api/supabaseClient";
import { extOf, squareCrop } from "../../shared/image";
import { Avatar } from "../../design-system/components/Avatar";
import { Button } from "../../design-system/components/Button";
import { Icon } from "../../design-system/components/Icon";
import { TextField } from "../../design-system/components/FormField";
import { ROLE_LABELS, hasTier } from "../../shared/types";

// Self-service photo upload/removal is turned off for the time being —
// avatars are being set manually. Flip this back on to restore it.
const PHOTO_EDIT_ENABLED = false;

async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/avatar.${extOf(blob)}`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    upsert: true,
    contentType: blob.type,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust — re-uploading keeps the same path, so without this a browser
  // that already cached the old image at that URL would keep showing it.
  return `${data.publicUrl}?t=${Date.now()}`;
}

export function AccountProfile() {
  const { profile, tier, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useSetHeader({ kicker: "ACCOUNT", title: "Account settings" }, []);

  if (!profile) return null;

  const dirty = name.trim() !== profile.name && name.trim().length > 0;

  const save = async () => {
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateMe(name.trim());
      await refreshProfile();
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const pickPhoto = () => fileInput.current?.click();

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const blob = await squareCrop(file);
      const url = await uploadAvatar(profile.id, blob);
      await api.updateAvatar(url);
      await refreshProfile();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      await api.updateAvatar(null);
      await refreshProfile();
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPhotoBusy(false);
    }
  };

  return (
    <div>
      <div className="bq-card bq-card--md" style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        {PHOTO_EDIT_ENABLED ? (
          <>
            <input ref={fileInput} type="file" accept="image/*" onChange={onPhotoSelected} style={{ display: "none" }} />
            <button
              onClick={pickPhoto}
              disabled={photoBusy}
              aria-label="Change photo"
              style={{ position: "relative", border: 0, background: "none", padding: 0, cursor: photoBusy ? "default" : "pointer", borderRadius: 999 }}
            >
              <Avatar name={profile.name} size={84} src={profile.avatarUrl} />
              <span
                aria-hidden
                style={{
                  position: "absolute",
                  right: -2,
                  bottom: -2,
                  width: 30,
                  height: 30,
                  borderRadius: 999,
                  background: "var(--color-bg-fill-primary-default)",
                  color: "var(--color-bg-surface-primary-default)",
                  border: "2px solid var(--color-bg-surface-primary-default)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="pencil" size={14} />
              </span>
            </button>
            <button
              onClick={pickPhoto}
              disabled={photoBusy}
              style={{ border: 0, background: "none", padding: 0, cursor: photoBusy ? "default" : "pointer", font: "700 var(--text-footnote-size) var(--font-family-body)", color: "var(--color-bg-fill-primary-active)" }}
            >
              {photoBusy ? "Uploading…" : "Change photo"}
            </button>
            {profile.avatarUrl && !photoBusy && (
              <button
                onClick={removePhoto}
                style={{ border: 0, background: "none", padding: 0, cursor: "pointer", font: "600 var(--text-footnote-size) var(--font-family-body)", color: "var(--color-text-tertiary-default)" }}
              >
                Remove photo
              </button>
            )}
            {photoError && (
              <div className="bq-rise" style={{ width: "100%", font: "600 var(--text-footnote-size)/1.5 var(--font-family-body)", color: "var(--color-text-status-danger-default)", background: "var(--color-bg-fill-status-danger-default)", borderRadius: "var(--radius-item)", padding: "10px 14px" }}>
                {photoError}
              </div>
            )}
          </>
        ) : (
          <Avatar name={profile.name} size={84} src={profile.avatarUrl} />
        )}
      </div>

      <div className="bq-card bq-card--md" style={{ marginBottom: 16 }}>
        <TextField
          label="NAME"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        {error && (
          <div  className="bq-error bq-error--spaced bq-rise">
            {error}
          </div>
        )}
        {saved && !error && (
          <div style={{ marginTop: 12, font: "600 var(--text-footnote-size)/1.5 var(--font-family-body)", color: "var(--color-bg-fill-primary-active)", background: "var(--color-bg-fill-accent-default)", borderRadius: "var(--radius-item)", padding: "10px 14px" }}>
            Saved.
          </div>
        )}
        <Button fullWidth size="lg" style={{ marginTop: 14 }} disabled={busy || !dirty} onClick={save}>
          {busy ? "Saving…" : "Save name"}
        </Button>
      </div>

      <div className="bq-card" style={{ padding: "6px 4px", marginBottom: 12 }}>
        <Row k="EMAIL" v={profile.email} />
        <Row k="ROLE" v={ROLE_LABELS[profile.role]} last={!hasTier(profile.role)} />
        {hasTier(profile.role) && (
          <Row k="TIER" v={tier ? `${tier.name} · ${tier.rate} EGP / session` : "Not assigned"} last />
        )}
      </div>
      <div style={{ padding: "0 4px", font: "400 var(--text-footnote-size)/1.5 var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>
        Email, role, and tier are managed by a department head.
      </div>
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`bq-listrow bq-listrow--compact ${!(last) ? "bq-listrow--divider" : ""}`}>
      <span style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)", width: 90, flex: "none" }}>{k}</span>
      <span style={{ font: "600 var(--text-body-size) var(--font-family-body)", color: "var(--color-text-primary-default)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}

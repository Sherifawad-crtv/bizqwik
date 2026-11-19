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
import "./AccountProfile.css";

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
      <div className="bq-card bq-card--md bq-mb-4 bq-flex bq-col bq-items-center bq-gap-10px">
        {PHOTO_EDIT_ENABLED ? (
          <>
            <input className="bq-account-profile-input" ref={fileInput} type="file" accept="image/*" onChange={onPhotoSelected} />
            <button className="bq-account-profile-btn"
              onClick={pickPhoto}
              disabled={photoBusy}
              aria-label="Change photo"
              style={{ cursor: photoBusy ? "default" : "pointer" }}
            >
              <Avatar name={profile.name} size={84} src={profile.avatarUrl} />
              <span className="bq-account-profile-row"
                aria-hidden
              >
                <Icon name="pencil" size={14} />
              </span>
            </button>
            <button className="bq-account-profile-btn-2"
              onClick={pickPhoto}
              disabled={photoBusy}
              style={{ cursor: photoBusy ? "default" : "pointer" }}
            >
              {photoBusy ? "Uploading…" : "Change photo"}
            </button>
            {profile.avatarUrl && !photoBusy && (
              <button className="bq-account-profile-btn-3"
                onClick={removePhoto}
              >
                Remove photo
              </button>
            )}
            {photoError && (
              <div className="bq-rise bq-account-profile-text">
                {photoError}
              </div>
            )}
          </>
        ) : (
          <Avatar name={profile.name} size={84} src={profile.avatarUrl} />
        )}
      </div>

      <div className="bq-card bq-card--md bq-mb-4">
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
          <div className="bq-account-profile-text-2">
            Saved.
          </div>
        )}
        <Button className="bq-mt-14px" fullWidth size="lg" disabled={busy || !dirty} onClick={save}>
          {busy ? "Saving…" : "Save name"}
        </Button>
      </div>

      <div className="bq-card bq-account-profile-spacing">
        <Row k="EMAIL" v={profile.email} />
        <Row k="ROLE" v={ROLE_LABELS[profile.role]} last={!hasTier(profile.role)} />
        {hasTier(profile.role) && (
          <Row k="TIER" v={tier ? `${tier.name} · ${tier.rate} EGP / session` : "Not assigned"} last />
        )}
      </div>
      <div className="bq-account-profile-meta">
        Email, role, and tier are managed by a department head.
      </div>
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`bq-listrow bq-listrow--compact ${!(last) ? "bq-listrow--divider" : ""}`}>
      <span className="bq-account-profile-row-label">{k}</span>
      <span className="bq-account-profile-row-text">{v}</span>
    </div>
  );
}

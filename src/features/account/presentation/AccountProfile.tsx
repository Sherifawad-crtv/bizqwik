import { useRef, useState } from "react";
import { useAuth } from "../../../shared/auth";
import { useSetHeader } from "../../../shared/screen/header";
import { squareCrop } from "../../../shared/image";
import { checkName, nameChanged } from "../domain/profile";
import { usePhoto, useRename } from "./hooks/useAccountActions";
import { Avatar } from "../../../design-system/components/Avatar";
import { Button } from "../../../design-system/components/Button";
import { Icon } from "../../../design-system/components/Icon";
import { TextField } from "../../../design-system/components/FormField";
import { ROLE_LABELS, hasTier } from "../../../shared/types";
import "./AccountProfile.css";

// Self-service photo upload/removal is turned off for the time being —
// avatars are being set manually. Flip this back on to restore it.
const PHOTO_EDIT_ENABLED = false;


export function AccountProfile() {
  const { profile, tier, refreshProfile } = useAuth();
  const [name, setName] = useState(profile?.name ?? "");
  const { save: rename, busy, error } = useRename(refreshProfile);
  const [saved, setSaved] = useState(false);
  const photo = usePhoto(profile?.id ?? "", refreshProfile);
  const { busy: photoBusy, error: photoError } = photo;
  const fileInput = useRef<HTMLInputElement>(null);

  useSetHeader({ kicker: "ACCOUNT", title: "Account settings" }, []);

  if (!profile) return null;

  const dirty = nameChanged(name, profile.name);

  const save = async () => {
    if (checkName(name).ok) setSaved(false);
    if (await rename(name)) setSaved(true);
  };

  const pickPhoto = () => fileInput.current?.click();

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await photo.upload(() => squareCrop(file));
  };

  const removePhoto = async () => {
    await photo.remove();
  };

  return (
    <div>
      <div className="bq-card bq-card--md bq-mb-4 bq-flex bq-col bq-items-center bq-gap-2">
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
        <Button className="bq-mt-4" fullWidth size="lg" disabled={busy || !dirty} onClick={save}>
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

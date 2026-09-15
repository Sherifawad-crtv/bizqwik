import { useRef, useState } from "react";
import { useAuth } from "../lib/auth";
import { useSetHeader } from "../lib/header";
import { api } from "../lib/backend";
import { supabase } from "../lib/supabaseClient";
import { Avatar } from "../components/Avatar";
import { Button } from "../components/Button";
import { Icon } from "../components/Icon";
import { TextField } from "../components/FormField";
import { ROLE_LABELS } from "../lib/types";

// Self-service photo upload/removal is turned off for the time being —
// avatars are being set manually. Flip this back on to restore it.
const PHOTO_EDIT_ENABLED = true;

// Center-crop to a square, then downscale — every avatar in the app is
// rendered as a circle via object-fit: cover, so a square source is all
// that's ever needed regardless of the uploaded photo's original aspect.
async function squareCrop(file: File, targetSize = 512): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image."));
      el.src = objectUrl;
    });
    const side = Math.min(img.width, img.height);
    const sx = (img.width - side) / 2;
    const sy = (img.height - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = targetSize;
    canvas.height = targetSize;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process that image.");
    ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSize, targetSize);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))), "image/jpeg", 0.88);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function uploadAvatar(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    upsert: true,
    contentType: "image/jpeg",
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
      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 20, marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
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
                  background: "var(--primary)",
                  color: "var(--surface)",
                  border: "2px solid var(--surface)",
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
              style={{ border: 0, background: "none", padding: 0, cursor: photoBusy ? "default" : "pointer", font: "700 13px var(--font-body)", color: "var(--primary-pressed)" }}
            >
              {photoBusy ? "Uploading…" : "Change photo"}
            </button>
            {profile.avatarUrl && !photoBusy && (
              <button
                onClick={removePhoto}
                style={{ border: 0, background: "none", padding: 0, cursor: "pointer", font: "600 13px var(--font-body)", color: "var(--ink-faint)" }}
              >
                Remove photo
              </button>
            )}
            {photoError && (
              <div style={{ width: "100%", font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
                {photoError}
              </div>
            )}
          </>
        ) : (
          <Avatar name={profile.name} size={84} src={profile.avatarUrl} />
        )}
      </div>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: 20, marginBottom: 16 }}>
        <TextField
          label="NAME"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
        />
        {error && (
          <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: 14, padding: "10px 14px" }}>
            {error}
          </div>
        )}
        {saved && !error && (
          <div style={{ marginTop: 12, font: "600 13px/1.5 var(--font-body)", color: "var(--primary-pressed)", background: "var(--primary-tint)", borderRadius: 14, padding: "10px 14px" }}>
            Saved.
          </div>
        )}
        <Button fullWidth size="lg" style={{ marginTop: 14 }} disabled={busy || !dirty} onClick={save}>
          {busy ? "Saving…" : "Save name"}
        </Button>
      </div>

      <div data-sq style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--r-card)", padding: "6px 4px", marginBottom: 12 }}>
        <Row k="EMAIL" v={profile.email} />
        <Row k="ROLE" v={ROLE_LABELS[profile.role]} last={profile.role === "accountant"} />
        {profile.role !== "accountant" && (
          <Row k="TIER" v={tier ? `${tier.name} · ${tier.rate} EGP / session` : "Not assigned"} last />
        )}
      </div>
      <div style={{ padding: "0 4px", font: "400 13px/1.5 var(--font-mono)", color: "var(--ink-faint)" }}>
        Email, role, and tier are managed by a department head.
      </div>
    </div>
  );
}

function Row({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <span style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", width: 90, flex: "none" }}>{k}</span>
      <span style={{ font: "600 15px var(--font-body)", color: "var(--ink)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}

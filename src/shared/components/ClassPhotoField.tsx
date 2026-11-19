import { useRef, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { classCardCrop, extOf } from "../image";
import { useAuth } from "../auth";
import { Icon } from "../../design-system/components/Icon";
import { Button } from "../../design-system/components/Button";
import "./ClassPhotoField.css";

const BUCKET = "class-images";

async function uploadClassPhoto(uid: string, blob: Blob): Promise<string> {
  const path = `${uid}/${crypto.randomUUID()}.${extOf(blob)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

/** The photo members see on a class card. Any photo is cropped to the card's
 * 4:5 shape before upload, and the preview shows it the way members will. */
export function ClassPhotoField({ value, onChange, title }: { value: string | null; onChange: (url: string | null) => void; title: string }) {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;
    setBusy(true);
    setError(null);
    try {
      onChange(await uploadClassPhoto(profile.id, await classCardCrop(file)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="bq-class-photo-field-label">PHOTO</div>
      <div className="bq-flex bq-gap-14px bq-items-center">
        <div
          data-testid="class-photo-preview"
          style={{
            position: "relative", width: 88, aspectRatio: "4 / 5", flex: "none", borderRadius: "var(--radius-item)", overflow: "hidden",
            background: "var(--color-bg-surface-secondary-default)", border: value ? 0 : "1.5px dashed var(--color-border-primary-default)", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {value ? (
            <>
              <img className="bq-class-photo-field-img" src={value} alt="" />
              <div className="bq-class-photo-field-layer" />
              <div className="bq-class-photo-field-title">{title || "Class"}</div>
            </>
          ) : (
            <Icon name="plus" size={20} style={{ color: "var(--color-text-tertiary-default)" }} />
          )}
        </div>
        <div className="bq-grow">
          <div className="bq-flex bq-gap-10px bq-items-center bq-wrap">
            <input className="bq-class-photo-field-input" ref={input} type="file" accept="image/*" onChange={onPick} data-testid="class-photo-input" />
            <Button variant="secondary" size="md" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Uploading…" : value ? "Replace" : "Add photo"}
            </Button>
            {value && !busy && (
              <button className="bq-class-photo-field-btn" onClick={() => onChange(null)}>
                Remove
              </button>
            )}
          </div>
          <div className="bq-class-photo-field-meta">
            {value ? "Cropped to fit the class card in the members' app." : "Members see a Bizqwik photo until you add one. Any photo works; it's cropped to fit."}
          </div>
          {error && <div className="bq-class-photo-field-text">{error}</div>}
        </div>
      </div>
    </div>
  );
}

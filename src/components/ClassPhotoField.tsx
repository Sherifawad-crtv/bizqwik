import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { classCardCrop, extOf } from "../lib/image";
import { useAuth } from "../lib/auth";
import { Icon } from "./Icon";
import { Button } from "./Button";

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
      <div style={{ font: "700 var(--text-caption-2-size) var(--font-family-mono)", letterSpacing: ".08em", color: "var(--color-text-tertiary-default)", margin: "0 2px 6px" }}>PHOTO</div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div
          data-testid="class-photo-preview"
          style={{
            position: "relative", width: 88, aspectRatio: "4 / 5", flex: "none", borderRadius: "var(--radius-item)", overflow: "hidden",
            background: "var(--color-bg-surface-secondary-default)", border: value ? 0 : "1.5px dashed var(--color-border-primary-default)", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {value ? (
            <>
              <img src={value} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, var(--color-bg-overlay-photo), transparent 60%)" }} />
              <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, color: "var(--color-text-on-media-default)", font: "800 var(--text-caption-2-size)/1.15 var(--font-family-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || "Class"}</div>
            </>
          ) : (
            <Icon name="plus" size={20} style={{ color: "var(--color-text-tertiary-default)" }} />
          )}
        </div>
        <div className="bq-grow">
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input ref={input} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} data-testid="class-photo-input" />
            <Button variant="secondary" size="md" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Uploading…" : value ? "Replace" : "Add photo"}
            </Button>
            {value && !busy && (
              <button onClick={() => onChange(null)} style={{ border: 0, background: "none", padding: 0, cursor: "pointer", font: "600 var(--text-footnote-size) var(--font-family-body)", color: "var(--color-text-tertiary-default)" }}>
                Remove
              </button>
            )}
          </div>
          <div style={{ marginTop: 6, font: "400 var(--text-caption-1-size)/1.45 var(--font-family-mono)", color: "var(--color-text-tertiary-default)" }}>
            {value ? "Cropped to fit the class card in the members' app." : "Members see a Bizqwik photo until you add one. Any photo works; it's cropped to fit."}
          </div>
          {error && <div style={{ marginTop: 6, font: "600 var(--text-caption-1-size)/1.4 var(--font-family-body)", color: "var(--color-text-status-danger-default)" }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

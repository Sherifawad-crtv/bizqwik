import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { classCardCrop } from "../lib/image";
import { useAuth } from "../lib/auth";
import { Icon } from "./Icon";
import { Button } from "./Button";

const BUCKET = "class-images";

async function uploadClassPhoto(uid: string, blob: Blob): Promise<string> {
  const path = `${uid}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
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
      <div style={{ font: "700 11px var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "0 2px 6px" }}>PHOTO</div>
      <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
        <div
          data-testid="class-photo-preview"
          style={{
            position: "relative", width: 88, aspectRatio: "4 / 5", flex: "none", borderRadius: 16, overflow: "hidden",
            background: "var(--sunken)", border: value ? 0 : "1.5px dashed var(--line)", display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {value ? (
            <>
              <img src={value} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(0,0,0,.7), transparent 60%)" }} />
              <div style={{ position: "absolute", left: 8, right: 8, bottom: 8, color: "#fff", font: "800 11px/1.15 var(--font-body)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title || "Class"}</div>
            </>
          ) : (
            <Icon name="plus" size={20} style={{ color: "var(--ink-faint)" }} />
          )}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <input ref={input} type="file" accept="image/*" onChange={onPick} style={{ display: "none" }} data-testid="class-photo-input" />
            <Button variant="secondary" size="md" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? "Uploading…" : value ? "Replace" : "Add photo"}
            </Button>
            {value && !busy && (
              <button onClick={() => onChange(null)} style={{ border: 0, background: "none", padding: 0, cursor: "pointer", font: "600 13px var(--font-body)", color: "var(--ink-faint)" }}>
                Remove
              </button>
            )}
          </div>
          <div style={{ marginTop: 6, font: "400 12px/1.45 var(--font-mono)", color: "var(--ink-faint)" }}>
            {value ? "Cropped to fit the class card in the members' app." : "Members see a Bizqwik photo until you add one. Any photo works; it's cropped to fit."}
          </div>
          {error && <div style={{ marginTop: 6, font: "600 12px/1.4 var(--font-body)", color: "var(--danger-fg)" }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

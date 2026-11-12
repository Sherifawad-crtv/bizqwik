import { useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { extOf, screenCrop, squareCrop } from "../../../lib/image";
import { Icon } from "../../../components/Icon";
import { TextField } from "../../../components/FormField";
import { Button } from "../../../components/Button";

const ORG_BRANDING_BUCKET = "org-branding";

async function uploadOrgAsset(orgId: string, assetKey: string, blob: Blob): Promise<string> {
  const path = `${orgId}/${assetKey}.${extOf(blob)}`;
  const { error } = await supabase.storage.from(ORG_BRANDING_BUCKET).upload(path, blob, {
    upsert: true,
    contentType: blob.type,
    cacheControl: "3600",
  });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from(ORG_BRANDING_BUCKET).getPublicUrl(path);
  // Cache-bust — re-uploading keeps the same path, so without this a browser
  // that already cached the old image at that URL would keep showing it.
  return `${data.publicUrl}?t=${Date.now()}`;
}

/** Image upload field for org branding: a preview tile + Upload/Replace
 * button, with a URL field underneath for pasting an existing asset's link
 * (e.g. one already hosted on a CDN) instead of uploading a new file. Both
 * paths write to the same `value`/`onChange`. */
export function ImageUploadField({
  orgId,
  assetKey,
  label,
  value,
  onChange,
  hint,
}: {
  orgId: string;
  assetKey: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      // Onboarding art is full screen: keep it tall and sharp. Logos and icons stay square.
      const blob = assetKey.startsWith("art-") ? await screenCrop(file) : await squareCrop(file);
      const url = await uploadOrgAsset(orgId, assetKey, blob);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't upload that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ font: "700 var(--fs-caption) var(--font-mono)", letterSpacing: ".08em", color: "var(--ink-faint)", margin: "0 2px 6px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div
          style={{
            width: 56,
            height: 56,
            flex: "none",
            borderRadius: "var(--r-input)",
            background: "var(--sunken)",
            border: "1px solid var(--line)",
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {value ? (
            <img src={value} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Icon name="plus" size={18} style={{ color: "var(--ink-faint)" }} />
          )}
        </div>
        <input ref={fileInput} type="file" accept="image/*" onChange={onSelected} style={{ display: "none" }} />
        <Button variant="secondary" size="md" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </Button>
        {value && !busy && (
          <button
            onClick={() => onChange("")}
            style={{ border: 0, background: "none", padding: 0, cursor: "pointer", font: "600 var(--fs-note) var(--font-body)", color: "var(--ink-faint)" }}
          >
            Remove
          </button>
        )}
      </div>
      {hint && <div style={{ font: "400 var(--fs-small)/1.5 var(--font-mono)", color: "var(--ink-faint)", margin: "6px 2px 0" }}>{hint}</div>}
      {error && (
        <div className="bq-rise" style={{ marginTop: 8, font: "600 var(--fs-note)/1.5 var(--font-body)", color: "var(--danger-fg)", background: "var(--danger-bg)", borderRadius: "var(--r-md)", padding: "10px 14px" }}>
          {error}
        </div>
      )}
      <div style={{ marginTop: 8 }}>
        <TextField label="OR PASTE A URL" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
      </div>
    </div>
  );
}

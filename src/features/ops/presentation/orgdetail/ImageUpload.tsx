import { useRef } from "react";
import { screenCrop, squareCrop } from "../../../../shared/image";
import { useAssetUpload } from "../hooks/useOps";
import { Icon } from "../../../../design-system/components/Icon";
import { TextField } from "../../../../design-system/components/FormField";
import { Button } from "../../../../design-system/components/Button";
import "./ImageUpload.css";

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
  const { upload, busy, error } = useAssetUpload(orgId, assetKey);
  const fileInput = useRef<HTMLInputElement>(null);

  const onSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    // Onboarding art is full screen: keep it tall and sharp. Logos and icons stay square.
    const url = await upload(() => (assetKey.startsWith("art-") ? screenCrop(file) : squareCrop(file)));
    if (url) onChange(url);
  };

  return (
    <div>
      <div className="bq-ops-image-upload-field-label">{label}</div>
      <div className="bq-flex bq-items-center bq-gap-3">
        <div className="bq-ops-image-upload-field-row"
        >
          {value ? (
            <img className="bq-ops-image-upload-field-img" src={value} alt="" />
          ) : (
            <Icon name="plus" size={18} className="bq-fg-tertiary" />
          )}
        </div>
        <input className="bq-ops-image-upload-field-input" ref={fileInput} type="file" accept="image/*" onChange={onSelected} />
        <Button variant="secondary" size="md" disabled={busy} onClick={() => fileInput.current?.click()}>
          {busy ? "Uploading…" : value ? "Replace" : "Upload"}
        </Button>
        {value && !busy && (
          <button className="bq-ops-image-upload-field-btn"
            onClick={() => onChange("")}
          >
            Remove
          </button>
        )}
      </div>
      {hint && <div className="bq-ops-image-upload-field-meta">{hint}</div>}
      {error && (
        <div className="bq-rise bq-ops-image-upload-field-text">
          {error}
        </div>
      )}
      <div className="bq-mt-2">
        <TextField label="OR PASTE A URL" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://…" />
      </div>
    </div>
  );
}

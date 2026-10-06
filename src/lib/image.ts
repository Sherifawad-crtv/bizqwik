// Every image we store is WebP: the same picture in far fewer bytes. All uploads
// go through one of the crops below, which end in encodeImage(). A browser that
// can't write WebP (some older Safari) gets a JPEG instead, so an upload never
// fails; extOf() says which one a blob is.
export async function encodeImage(canvas: HTMLCanvasElement, quality = 0.9): Promise<Blob> {
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
  const webp = await toBlob("image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob("image/jpeg", quality);
  if (!jpeg) throw new Error("Couldn't process that image.");
  return jpeg;
}
/** File extension for an encoded image blob. */
export const extOf = (blob: Blob): "webp" | "jpg" => (blob.type === "image/webp" ? "webp" : "jpg");
/** Same for a data URL (the InstaPay QR is stored as one). */
export function canvasToDataUrl(canvas: HTMLCanvasElement, quality = 0.9): string {
  const webp = canvas.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
}

// Center-crop an arbitrary image file to a square, then downscale to a JPEG
// blob ready for upload. Shared by every "upload a photo/logo/icon" flow in
// the app — every one of them renders the result via object-fit: cover, so a
// square source is all that's ever needed regardless of the original aspect.
export async function squareCrop(file: File, targetSize = 512): Promise<Blob> {
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
    return await encodeImage(canvas, 0.88);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Crops a photo to a class card (4:5 portrait, 1080×1350 JPEG). A landscape
 * shot keeps its centre; a tall one keeps its upper part (a third of the
 * spare height is cut from the top, two thirds from the bottom), where heads
 * and faces usually are. */
export async function classCardCrop(file: File, width = 1080, height = 1350): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image."));
      el.src = objectUrl;
    });
    const target = width / height;
    let sw = img.width;
    let sh = img.height;
    let sx = 0;
    let sy = 0;
    if (img.width / img.height > target) {
      sw = img.height * target;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / target;
      sy = (img.height - sh) / 3;
    }
    // Never upscale a small photo beyond its own resolution.
    const scale = Math.min(1, sw / width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale) || width;
    canvas.height = Math.round(height * scale) || height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process that image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    return await encodeImage(canvas, 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Onboarding art is shown full screen on a phone, so it keeps a tall 1:2
 * shape and plenty of pixels (1080×2160) instead of the logo's 512px square.
 * A smaller photo is never blown up past its own resolution. Saved as a high
 * quality WebP, stepped down only if it would pass the 2MB upload limit. */
export async function screenCrop(file: File, width = 1080, height = 2160, maxBytes = 1_900_000): Promise<Blob> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't read that image."));
      el.src = objectUrl;
    });
    const target = width / height;
    let sw = img.width;
    let sh = img.height;
    let sx = 0;
    let sy = 0;
    if (img.width / img.height > target) {
      sw = img.height * target;
      sx = (img.width - sw) / 2;
    } else {
      sh = img.width / target;
      sy = (img.height - sh) / 3;
    }
    const scale = Math.min(1, sw / width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale) || width;
    canvas.height = Math.round(height * scale) || height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Couldn't process that image.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    let blob: Blob | null = null;
    for (const q of [0.92, 0.86, 0.8, 0.74]) {
      blob = await encodeImage(canvas, q);
      if (blob.size <= maxBytes) break;
    }
    if (!blob) throw new Error("Couldn't process that image.");
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

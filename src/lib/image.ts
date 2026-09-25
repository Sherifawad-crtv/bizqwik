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
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))), "image/jpeg", 0.88);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

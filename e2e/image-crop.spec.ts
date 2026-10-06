import { test, expect } from "@playwright/test";

// Onboarding art is full screen on a phone. It used to be cut to a 512px square
// (the logo's crop), which looked pixelated. These check the full-screen crop.
test("onboarding art keeps a tall, sharp 1080×2160; a small photo is never upscaled", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { screenCrop, squareCrop, classCardCrop, extOf, canvasToDataUrl } = await import("/src/lib/image.ts");
    const make = async (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w; c.height = h;
      const ctx = c.getContext("2d")!;
      for (let i = 0; i < 60; i++) { ctx.fillStyle = `hsl(${i * 6},70%,${30 + (i % 5) * 8}%)`; ctx.fillRect((i * w) / 60, 0, w / 60 + 1, h); }
      const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.95));
      return new File([blob], "x.jpg", { type: "image/jpeg" });
    };
    const dims = async (b: Blob) => {
      const bmp = await createImageBitmap(b);
      return { w: bmp.width, h: bmp.height, size: b.size };
    };
    return {
      big: await dims(await screenCrop(await make(3000, 4000))),
      wide: await dims(await screenCrop(await make(4000, 3000))),
      small: await dims(await screenCrop(await make(600, 1300))),
      logo: await dims(await squareCrop(await make(3000, 4000))),
      types: {
        logo: (await squareCrop(await make(800, 800))).type,
        card: (await classCardCrop(await make(1600, 2000))).type,
        art: (await screenCrop(await make(1600, 3200))).type,
      },
      ext: extOf(await squareCrop(await make(800, 800))),
      qr: canvasToDataUrl(Object.assign(document.createElement("canvas"), { width: 50, height: 50 })).slice(0, 15),
    };
  });
  expect(r.big).toMatchObject({ w: 1080, h: 2160 });
  expect(r.big.size).toBeLessThan(2_000_000);
  expect(r.wide).toMatchObject({ w: 1080, h: 2160 });
  // 600 px wide source: kept at its own resolution, not blown up.
  expect(r.small.w).toBeLessThanOrEqual(600);
  expect(Math.abs(r.small.h / r.small.w - 2)).toBeLessThan(0.02);
  // Logos and icons are unchanged: 512 square.
  expect(r.logo).toMatchObject({ w: 512, h: 512 });
});

test("every upload is turned into WebP", async ({ page }) => {
  await page.goto("/");
  const r = await page.evaluate(async () => {
    const { squareCrop, classCardCrop, screenCrop, extOf, canvasToDataUrl } = await import("/src/lib/image.ts");
    const c = document.createElement("canvas");
    c.width = 900; c.height = 1200;
    const ctx = c.getContext("2d")!; ctx.fillStyle = "#4a6"; ctx.fillRect(0, 0, 900, 1200);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
    const f = new File([blob], "photo.png", { type: "image/png" });
    const out = { logo: await squareCrop(f), card: await classCardCrop(f), art: await screenCrop(f) };
    return {
      types: [out.logo.type, out.card.type, out.art.type],
      ext: extOf(out.logo),
      qr: canvasToDataUrl(c).slice(0, 15),
    };
  });
  expect(r.types).toEqual(["image/webp", "image/webp", "image/webp"]);
  expect(r.ext).toBe("webp");
  expect(r.qr).toBe("data:image/webp");
});

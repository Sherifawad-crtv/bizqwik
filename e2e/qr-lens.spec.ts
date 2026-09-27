import { test, expect, type Page } from "@playwright/test";
import { mockBackend } from "./mocks";

// The coach scanner offers 0.5× (ultra-wide) only on phones that expose it:
// either by zooming the back camera below 1×, or as a separate ultra-wide camera.
test.use({ viewport: { width: 390, height: 844 } });

// A live canvas stream stands in for the camera; `kind` decides how the fake
// phone exposes its ultra-wide lens. Calls are recorded on window.__lens.
async function fakeCamera(page: Page, kind: "zoom" | "device" | "none") {
  await page.addInitScript((k) => {
    const log: { gum: unknown[]; zoom: unknown[] } = { gum: [], zoom: [] };
    (window as unknown as { __lens: typeof log }).__lens = log;
    navigator.mediaDevices.getUserMedia = async (c) => {
      log.gum.push(c);
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 240;
      const ctx = canvas.getContext("2d")!;
      setInterval(() => { ctx.fillStyle = "#333"; ctx.fillRect(0, 0, 320, 240); }, 50);
      const stream = (canvas as HTMLCanvasElement & { captureStream(fps?: number): MediaStream }).captureStream(10);
      const track = stream.getVideoTracks()[0];
      const dev = (c as { video?: { deviceId?: { exact: string } } })?.video?.deviceId?.exact ?? "main-cam";
      track.getCapabilities = () => (k === "zoom" ? { zoom: { min: 0.5, max: 5, step: 0.1 } } : {}) as MediaTrackCapabilities;
      track.getSettings = () => ({ deviceId: dev }) as MediaTrackSettings;
      track.applyConstraints = async (x) => { log.zoom.push(x); };
      return stream;
    };
    navigator.mediaDevices.enumerateDevices = async () =>
      [
        { kind: "videoinput", label: "Back Camera", deviceId: "main-cam", groupId: "g" },
        ...(k === "device" ? [{ kind: "videoinput", label: "Back Ultra Wide Camera", deviceId: "uw-cam", groupId: "g" }] : []),
      ] as MediaDeviceInfo[];
  }, kind);
}
const lensLog = (page: Page) => page.evaluate(() => (window as unknown as { __lens: { gum: unknown[]; zoom: unknown[] } }).__lens);

test("0.5× zooms the camera out on phones that support zoom", async ({ page }) => {
  await fakeCamera(page, "zoom");
  await mockBackend(page, "coach");
  await page.goto("/");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByRole("button", { name: "Wide lens 0.5×" }).click();
  await expect(page.getByRole("button", { name: "Wide lens 0.5×" })).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => (await lensLog(page)).zoom).toContainEqual({ advanced: [{ zoom: 0.5 }] });
  await page.getByRole("button", { name: "Normal lens 1×" }).click();
  await expect.poll(async () => (await lensLog(page)).zoom).toContainEqual({ advanced: [{ zoom: 1 }] });
});

test("0.5× switches to the ultra-wide camera where it's a separate lens", async ({ page }) => {
  await fakeCamera(page, "device");
  await mockBackend(page, "coach");
  await page.goto("/");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.getByRole("button", { name: "Wide lens 0.5×" }).click();
  await expect.poll(async () => JSON.stringify((await lensLog(page)).gum)).toContain('"exact":"uw-cam"');
});

test("no 0.5× switch on phones without an ultra-wide lens", async ({ page }) => {
  await fakeCamera(page, "none");
  await mockBackend(page, "coach");
  await page.goto("/");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await page.waitForTimeout(800);
  await expect(page.getByRole("group", { name: "Camera lens" })).toHaveCount(0);
});

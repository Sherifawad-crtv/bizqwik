import { test, expect } from "@playwright/test";
import { mockBackend } from "./mocks";

// Some phones grant the camera but deliver no picture (right after the
// permission prompt, or in installed home-screen apps). The scanner must not
// sit on a black square: it offers a tap to start the camera, and says why
// when the browser refuses outright.
test.use({ viewport: { width: 390, height: 844 } });

test("a camera that gives no picture offers a tap to start it", async ({ page }) => {
  await page.addInitScript(() => {
    // A stream whose video track never produces a frame.
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      return (canvas as HTMLCanvasElement & { captureStream(fps: number): MediaStream }).captureStream(0);
    };
  });
  await mockBackend(page, "coach");
  await page.goto("/");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByRole("button", { name: "Tap to start the camera" })).toBeVisible({ timeout: 6000 });
});

test("a refused camera shows the exact reason", async ({ page }) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await mockBackend(page, "coach");
  await page.goto("/");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByText(/blocked the camera for this page/)).toBeVisible();
});

import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import QRCode from "qrcode";
import { mockBackend } from "./mocks";

// End-to-end decode: Chromium's fake camera plays a video of the coaches'-room
// QR, and the coach FAB scanner must actually read it (html5-qrcode showed the
// camera but never decoded — this guards the replacement).
function writeQrVideo(text: string): string {
  const W = 640, H = 480, scale = 8, quiet = 4;
  const qr = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const side = (n + quiet * 2) * scale;
  const x0 = Math.floor((W - side) / 2), y0 = Math.floor((H - side) / 2);
  const y = Buffer.alloc(W * H, 200);
  for (let py = 0; py < side; py++)
    for (let px = 0; px < side; px++) {
      const mx = Math.floor(px / scale) - quiet, my = Math.floor(py / scale) - quiet;
      const dark = mx >= 0 && my >= 0 && mx < n && my < n && qr.modules.get(my, mx);
      y[(y0 + py) * W + (x0 + px)] = dark ? 0 : 255;
    }
  const uv = Buffer.alloc((W / 2) * (H / 2), 128);
  const frame = Buffer.concat([Buffer.from("FRAME\n"), y, uv, uv]);
  const file = join(tmpdir(), `bq-staff-qr-${text}.y4m`);
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F10:1 Ip A1:1 C420jpeg\n`), frame, frame]));
  return file;
}

const TOKEN = "bqc_0123456789abcdef0123456789abcdef";

test.use({
  viewport: { width: 390, height: 844 },
  permissions: ["camera"],
  launchOptions: {
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium",
    args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${writeQrVideo(TOKEN)}`],
  },
});

test("coach FAB: the camera reads the coaches' room QR and opens the stepper", async ({ page }) => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const today = `${month}-${String(now.getDate()).padStart(2, "0")}`;
  let scanned: unknown = null;
  await mockBackend(page, "coach", {
    [`month/${month}`]: { rows: [{ coachId: "prof-zz", name: "Zed", email: "a@b.c", role: "coach", avatarUrl: null, tierId: null, tierName: null, rate: 150, count: 0, groupTotal: 0, privateTotal: 0, packageCount: 0, total: 0, state: "logging", settledAt: null, paidAt: null }] },
    [`prof-zz/${month}`]: { sessions: [] },
    scan: (b) => {
      scanned = b;
      return { body: { kind: "attendance", date: today, month } };
    },
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Scan", exact: true }).click();
  await expect(page.getByText("Log a session")).toBeVisible({ timeout: 10_000 });
  expect(scanned).toEqual({ token: TOKEN });
});

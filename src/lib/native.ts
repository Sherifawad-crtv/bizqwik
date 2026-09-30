// Makes the installed app behave like a native one: no pinch or double-tap
// zoom, no text selection or copy, no long-press menus, no dragging images out
// of the page, no rotating away from portrait. Form fields stay fully
// editable (typing, selecting, paste), and desktop browsers keep their own zoom.
const EDITABLE = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

function inEditable(t: EventTarget | null): boolean {
  return t instanceof Element && !!t.closest(EDITABLE);
}

export function installNativeFeel() {
  // Long-press / right-click menus ("Save image", "Copy", "Open in new tab").
  document.addEventListener("contextmenu", (e) => { if (!inEditable(e.target)) e.preventDefault(); });
  // Dragging an image or link out of the page.
  document.addEventListener("dragstart", (e) => e.preventDefault());
  // Select-all / copy / cut outside form fields.
  document.addEventListener("selectstart", (e) => { if (!inEditable(e.target)) e.preventDefault(); });
  document.addEventListener("copy", (e) => { if (!inEditable(e.target)) e.preventDefault(); });
  document.addEventListener("cut", (e) => { if (!inEditable(e.target)) e.preventDefault(); });

  // iOS Safari ignores user-scalable=no: block its pinch gestures. No touch
  // listener is added on purpose — a non-passive one makes scrolling wait for
  // JavaScript; `touch-action` in the CSS already turns off pinch and
  // double-tap zoom everywhere else.
  for (const type of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(type, (e) => e.preventDefault(), { passive: false });

  // Stay upright where the browser lets a web app do that (installed Android
  // app / fullscreen). iOS ignores this; there the OS decides.
  try {
    void (screen.orientation as any)?.lock?.("portrait")?.catch?.(() => {});
  } catch {
    // Not supported or not allowed here — the manifest's orientation covers installs.
  }
}

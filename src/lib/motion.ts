// One motion scale for the whole app, so everything moves the same way.
// Apple's guidance: quick, purposeful, interruptible. Nothing here is longer
// than 350 ms (loops like spinners and skeleton pulses aren't motions).
//
//   quick     150  fades, colour changes, presses, tooltips, titles
//   standard  250  things appearing (banners, rows, content), small moves
//   control   300  controls that travel: switches, sliding pills, the tab circle, reveals
//   screen    340  pushing into / backing out of a screen, sheets opening
//   sheetOut  280  sheets closing (leaving is a touch quicker than arriving)
//
// One curve (the iOS standard: starts fast, settles gently) and one gentle
// spring for confirmations. The same values live in index.css as --dur-* and
// --ease-* so CSS and code agree.
export const EASE = "cubic-bezier(.32,.72,0,1)";
export const SPRING = "cubic-bezier(.34,1.36,.64,1)";

export const QUICK_MS = 150;
export const STANDARD_MS = 250;
export const CONTROL_MS = 300;
export const SCREEN_MS = 340;
export const SHEET_OUT_MS = 280;
export const MAX_MOTION_MS = 350;

// Names used around the app.
export const FADE_MS = QUICK_MS; // tab switches, content swaps
export const PUSH_MS = SCREEN_MS; // drilling into / backing out of a screen
export const SHEET_IN_MS = SCREEN_MS;

// Not a motion: how long a big confirmation stays on screen before closing.
export const SUCCESS_HOLD_MS = 700;

/** A CSS transition string from the scale, e.g. tr("opacity", QUICK_MS). */
export const tr = (props: string | string[], ms: number, ease: string = EASE, delay = 0) =>
  (Array.isArray(props) ? props : [props]).map((p) => `${p} ${ms}ms ${ease}${delay ? ` ${delay}ms` : ""}`).join(", ");

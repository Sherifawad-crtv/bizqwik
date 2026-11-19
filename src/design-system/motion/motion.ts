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
// spring for confirmations. The values come from the design tokens
// (src/design-system/tokens/tokens.json), the same ones CSS reads as
// --duration-* and --ease-*, so CSS and code always agree.
import { tokens } from "../tokens/tokens";

export const EASE: string = tokens.easeStandard;
export const SPRING: string = tokens.easeSpring;

export const QUICK_MS: number = tokens.durationQuick;
export const STANDARD_MS: number = tokens.durationStandard;
export const CONTROL_MS: number = tokens.durationControl;
export const SCREEN_MS: number = tokens.durationScreen;
export const SHEET_OUT_MS: number = tokens.durationSheetOut;
export const MAX_MOTION_MS: number = tokens.durationMax;

// Names used around the app.
export const FADE_MS = QUICK_MS; // tab switches, content swaps
export const PUSH_MS = SCREEN_MS; // drilling into / backing out of a screen
export const SHEET_IN_MS = SCREEN_MS;

// Not a motion: how long a big confirmation stays on screen before closing.
export const SUCCESS_HOLD_MS: number = tokens.durationSuccessHold;

/** A CSS transition string from the scale, e.g. tr("opacity", QUICK_MS). */
export const tr = (props: string | string[], ms: number, ease: string = EASE, delay = 0) =>
  (Array.isArray(props) ? props : [props]).map((p) => `${p} ${ms}ms ${ease}${delay ? ` ${delay}ms` : ""}`).join(", ");

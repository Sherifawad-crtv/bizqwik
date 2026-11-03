// One place for how things move, so the whole app moves the same way.
// The curve is the iOS standard (the same one screen pushes already use): it
// starts fast and settles gently, and reads as one connected motion.
export const EASE = "cubic-bezier(.32,.72,0,1)";
export const PUSH_MS = 340; // drilling into / backing out of a screen
export const SHEET_IN_MS = 450;
export const SHEET_OUT_MS = 300;
export const FADE_MS = 150; // tab switches, content swaps
export const SUCCESS_HOLD_MS = 700; // a significant confirmation, then it closes

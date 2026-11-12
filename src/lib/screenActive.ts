import { createContext, useContext } from "react";

/** True for the screen the person is looking at. Screens kept underneath (or
 * on their way out) are false, so they stop re-requesting data in the
 * background; they catch up once when they become the current screen again. */
export const ScreenActive = createContext(true);
export const useScreenActive = () => useContext(ScreenActive);

import type { ReactNode } from "react";
import { EASE } from "../lib/motion";

/** Something that appears or goes away: it grows open and fades instead of
 * popping in and shoving everything below it. `gap` is the spacing the parent
 * puts between its children, taken back while closed so a hidden item leaves
 * no hole. */
export function Reveal({ show, children, gap = 0 }: { show: boolean; children: ReactNode; gap?: number }) {
  return (
    <div
      aria-hidden={!show}
      style={{
        display: "grid",
        gridTemplateRows: show ? "1fr" : "0fr",
        opacity: show ? 1 : 0,
        marginTop: show ? 0 : -gap,
        transition: `grid-template-rows .3s ${EASE}, opacity .2s ease, margin-top .3s ${EASE}`,
        pointerEvents: show ? undefined : "none",
      }}
    >
      <div
        style={{
          minHeight: 0,
          overflow: "hidden",
          // Out of sight and out of reach once it has finished closing.
          visibility: show ? "visible" : "hidden",
          transition: show ? "visibility 0s" : "visibility 0s linear .3s",
        }}
        inert={!show}
      >
        {children}
      </div>
    </div>
  );
}

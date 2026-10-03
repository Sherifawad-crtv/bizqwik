import type { ReactNode } from "react";
import hero from "../assets/auth-desktop.webp";

/** Sign-in and sign-up on a computer: the product in a rounded panel on the
 * left, the logo and form centred on the right. (Phones keep the single
 * column layout and the first-time welcome.) */
export function DesktopAuth({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", gap: 20, padding: 20, background: "var(--paper)" }}>
      <aside
        aria-hidden
        style={{
          flex: "1 1 50%",
          minWidth: 0,
          minHeight: "calc(100vh - 40px)",
          borderRadius: 32,
          overflow: "hidden",
          background: `var(--sunken) url(${hero}) center / cover no-repeat`,
        }}
      />
      <main style={{ flex: "1 1 50%", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 40, padding: "24px clamp(24px, 4vw, 72px)" }}>
        <img src="/wordmark.png" alt="Bizqwik" style={{ height: 52, width: "auto", display: "block" }} />
        {children}
      </main>
    </div>
  );
}

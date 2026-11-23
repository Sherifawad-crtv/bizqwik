import type { ReactNode } from "react";
import hero from "../../../assets/auth-desktop.webp";
import "./DesktopAuth.css";

/** Sign-in and sign-up on a computer: the product in a rounded panel on the
 * left, the logo and form centred on the right. (Phones keep the single
 * column layout and the first-time welcome.) */
export function DesktopAuth({ children }: { children: ReactNode }) {
  return (
    <div className="bq-auth-desktop-auth-row">
      <aside className="bq-auth-desktop-auth-box"
        aria-hidden
        style={{ background: `var(--color-bg-surface-secondary-default) url(${hero}) center / cover no-repeat` }}
      />
      <main className="bq-auth-desktop-auth-stack">
        <img className="bq-auth-desktop-auth-img" src="/wordmark.png" alt="Bizqwik" />
        {children}
      </main>
    </div>
  );
}

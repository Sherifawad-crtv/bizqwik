import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useIsMobile } from "../lib/useIsMobile";
import { hasSeenWelcome, markWelcomed } from "../lib/welcome";
import hero from "../assets/welcome.webp";

/** First-time landing: shown once per device, then it's the normal sign-in. */
export function Welcome() {
  const { profile, bizqwikTeam, ready } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  if (ready && profile) return <Navigate to="/" replace />;
  if (ready && bizqwikTeam) return <Navigate to="/bizqwik" replace />;
  // Anyone who has been here before skips straight to sign-in.
  // The welcome screen is a phone screen: computers go straight to sign-in.
  if (!isMobile || hasSeenWelcome()) return <Navigate to="/login" replace />;

  const go = (to: string) => {
    markWelcomed();
    navigate(to, { replace: true });
  };

  return (
    <div style={{ minHeight: "100svh", background: "var(--color-bg-canvas-default)", display: "flex", justifyContent: "center" }}>
      <div
        data-testid="welcome"
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 460,
          minHeight: "100svh",
          backgroundImage: `url(${hero})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: "100% auto",
          backgroundPosition: "top center",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            padding: "90px 24px calc(20px + var(--safe-bottom))",
            background: "linear-gradient(to bottom, var(--color-bg-canvas-fade-start) 0%, var(--color-bg-canvas-fade-middle) 38%, var(--color-bg-canvas-default) 62%)",
          }}
        >
          <h1 style={{ margin: 0, font: "800 32px/1.1 var(--font-family-body)", letterSpacing: "-.03em", color: "var(--color-text-primary-default)" }}>Welcome to Bizqwik!</h1>
          <p style={{ margin: "8px 0 22px", font: "400 var(--text-callout-size)/1.4 var(--font-family-body)", color: "var(--color-text-secondary-default)" }}>
            Easily manage your coaching operations, bookings, revenue, reward your clients and more.
          </p>
          <button
            className="bq-scale"
            onClick={() => go("/signup")}
            style={{ width: "100%", height: 60, border: 0, borderRadius: 999, background: "var(--color-bg-fill-primary-default)", color: "var(--color-text-on-fill-default)", font: "700 19px var(--font-family-body)", cursor: "pointer" }}
          >
            Get Started
          </button>
          <button
            className="bq-scale"
            onClick={() => go("/login")}
            style={{ width: "100%", height: 60, marginTop: 10, border: 0, borderRadius: 999, background: "var(--color-bg-fill-accent-default)", color: "var(--color-bg-fill-primary-active)", font: "700 var(--text-title-2-size) var(--font-family-body)", cursor: "pointer" }}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}

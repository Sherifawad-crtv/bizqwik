import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { hasSeenWelcome, markWelcomed } from "../lib/welcome";
import hero from "../assets/welcome.webp";

/** First-time landing: shown once per device, then it's the normal sign-in. */
export function Welcome() {
  const { profile, bizqwikTeam, ready } = useAuth();
  const navigate = useNavigate();

  if (ready && profile) return <Navigate to="/" replace />;
  if (ready && bizqwikTeam) return <Navigate to="/bizqwik" replace />;
  // Anyone who has been here before skips straight to sign-in.
  if (hasSeenWelcome()) return <Navigate to="/login" replace />;

  const go = (to: string) => {
    markWelcomed();
    navigate(to, { replace: true });
  };

  return (
    <div style={{ minHeight: "100svh", background: "var(--paper)", display: "flex", justifyContent: "center" }}>
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
            background: "linear-gradient(to bottom, rgba(243,242,238,0) 0%, rgba(243,242,238,.92) 38%, var(--paper) 62%)",
          }}
        >
          <h1 style={{ margin: 0, font: "800 32px/1.1 var(--font-body)", letterSpacing: "-.03em", color: "var(--ink)" }}>Welcome to Bizqwik!</h1>
          <p style={{ margin: "8px 0 22px", font: "400 16px/1.4 var(--font-body)", color: "var(--ink-muted)" }}>
            Easily manage your coaching operations, bookings, revenue, reward your clients and more.
          </p>
          <button
            data-tap
            onClick={() => go("/signup")}
            style={{ width: "100%", height: 60, border: 0, borderRadius: 999, background: "var(--primary)", color: "#fff", font: "700 19px var(--font-body)", cursor: "pointer" }}
          >
            Get Started
          </button>
          <button
            data-tap
            onClick={() => go("/login")}
            style={{ width: "100%", height: 60, marginTop: 10, border: 0, borderRadius: 999, background: "var(--primary-tint)", color: "var(--primary-pressed)", font: "700 20px var(--font-body)", cursor: "pointer" }}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}

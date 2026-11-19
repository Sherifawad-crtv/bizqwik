import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../shared/auth";
import { useIsMobile } from "../../design-system/hooks/useIsMobile";
import { hasSeenWelcome, markWelcomed } from "../../shared/welcome";
import hero from "../../assets/welcome.webp";
import "./Welcome.css";

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
    <div className="bq-auth-welcome-row">
      <div className="bq-auth-welcome-stack"
        data-testid="welcome"
        style={{ backgroundImage: `url(${hero})` }}
      >
        <div className="bq-auth-welcome-box"
        >
          <h1 className="bq-auth-welcome-heading">Welcome to Bizqwik!</h1>
          <p className="bq-auth-welcome-text">
            Easily manage your coaching operations, bookings, revenue, reward your clients and more.
          </p>
          <button
            className="bq-scale bq-auth-welcome-btn"
            onClick={() => go("/signup")}
          >
            Get Started
          </button>
          <button
            className="bq-scale bq-auth-welcome-btn-2"
            onClick={() => go("/login")}
          >
            Login
          </button>
        </div>
      </div>
    </div>
  );
}

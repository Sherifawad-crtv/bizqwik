import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { HeaderProvider } from "./lib/header";
import { OwnMonthProvider } from "./lib/ownMonth";
import { RequireAuth, RequireRole } from "./lib/guards";
import { Shell } from "./components/Shell";
import { initSquirclePolyfill } from "./lib/squircle";
import { SquircleDebugOverlay } from "./components/SquircleDebugOverlay";

import { Login } from "./routes/Login";
import { ForgotPassword } from "./routes/ForgotPassword";
import { ResetPassword } from "./routes/ResetPassword";
import { Home } from "./routes/Home";
import { CoachesOverview } from "./routes/CoachesOverview";
import { CoachDetail } from "./routes/CoachDetail";
import { Oversight } from "./routes/Oversight";
import { Manage } from "./routes/Manage";
import { Pay } from "./routes/Pay";
import { PayeeDetail } from "./routes/PayeeDetail";
import { History } from "./routes/History";
import { Clients } from "./routes/Clients";
import { Account } from "./routes/Account";
import { AccountProfile } from "./routes/AccountProfile";
import { AccountPassword } from "./routes/AccountPassword";

export default function App() {
  useEffect(() => {
    initSquirclePolyfill();
  }, []);

  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("squircle-debug")) {
    return <SquircleDebugOverlay />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <HeaderProvider>
          <OwnMonthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              <Route element={<RequireAuth />}>
                <Route element={<Shell />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/history" element={<History />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/account/profile" element={<AccountProfile />} />
                  <Route path="/account/password" element={<AccountPassword />} />

                  <Route element={<RequireRole roles={["head_coach", "dept_head"]} />}>
                    <Route path="/coaches" element={<CoachesOverview />} />
                    <Route path="/coaches/:id" element={<CoachDetail />} />
                  </Route>

                  <Route element={<RequireRole roles={["coach", "head_coach", "dept_head"]} />}>
                    <Route path="/clients" element={<Clients />} />
                  </Route>

                  <Route element={<RequireRole roles={["dept_head"]} />}>
                    <Route path="/oversight" element={<Oversight />} />
                    <Route path="/manage" element={<Manage />} />
                  </Route>

                  <Route element={<RequireRole roles={["accountant"]} />}>
                    <Route path="/pay" element={<Pay />} />
                    <Route path="/pay/:coachId" element={<PayeeDetail />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </OwnMonthProvider>
        </HeaderProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

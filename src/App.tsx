import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { HeaderProvider } from "./lib/header";
import { OwnMonthProvider } from "./lib/ownMonth";
import { RequireAuth, RequireRole, RequireBizqwikTeam } from "./lib/guards";
import { Shell } from "./components/Shell";
import { initSquirclePolyfill } from "./lib/squircle";

import { Login } from "./routes/Login";
import { Signup } from "./routes/Signup";
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
import { Members } from "./routes/frontdesk/Members";
import { CheckIn } from "./routes/frontdesk/CheckIn";
import { DropIn } from "./routes/frontdesk/DropIn";
import { Invitations } from "./routes/frontdesk/Invitations";
import { OpsShell } from "./routes/ops/OpsShell";
import { Overview as OpsOverview } from "./routes/ops/Overview";
import { OrgDetail as OpsOrgDetail } from "./routes/ops/OrgDetail";
import { Team as OpsTeam } from "./routes/ops/Team";
import { Plans as OpsPlans } from "./routes/ops/Plans";

export default function App() {
  useEffect(() => {
    initSquirclePolyfill();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <HeaderProvider>
          <OwnMonthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Bizqwik ops dashboard — bizqwik_team only, outside the org shell. */}
              <Route element={<RequireBizqwikTeam />}>
                <Route element={<OpsShell />}>
                  <Route path="/bizqwik" element={<OpsOverview />} />
                  <Route path="/bizqwik/orgs/:id" element={<OpsOrgDetail />} />
                  <Route path="/bizqwik/team" element={<OpsTeam />} />
                  <Route path="/bizqwik/plans" element={<OpsPlans />} />
                </Route>
              </Route>

              <Route element={<RequireAuth />}>
                <Route element={<Shell />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/account" element={<Account />} />
                  <Route path="/account/profile" element={<AccountProfile />} />
                  <Route path="/account/password" element={<AccountPassword />} />

                  <Route element={<RequireRole roles={["coach", "head_coach", "dept_head", "accountant"]} />}>
                    <Route path="/history" element={<History />} />
                  </Route>

                  <Route element={<RequireRole roles={["front_desk"]} />}>
                    <Route path="/members" element={<Members />} />
                    <Route path="/checkin" element={<CheckIn />} />
                    <Route path="/drop-in" element={<DropIn />} />
                    <Route path="/invitations" element={<Invitations />} />
                  </Route>

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

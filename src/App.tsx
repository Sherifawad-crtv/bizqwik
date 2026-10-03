import { Suspense, lazy, useEffect, type ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { HeaderProvider } from "./lib/header";
import { OwnMonthProvider } from "./lib/ownMonth";
import { RequireAuth, RequireRole, RequireBizqwikTeam, RequireDesk, RequireTeam } from "./lib/guards";
import { Spinner } from "./components/Spinner";
import { Shell } from "./components/Shell";
import { initSquirclePolyfill } from "./lib/squircle";

import { Login } from "./routes/Login";
import { Signup } from "./routes/Signup";
import { LaunchGate } from "./components/Splash";
import { Money } from "./routes/Money";
import { Home } from "./routes/Home";
import { Oversight } from "./routes/Oversight";
import { ClassesManage } from "./routes/ClassesManage";
import { Activity, Transactions } from "./routes/Activity";
import { Catalog } from "./routes/Catalog";
import { Account } from "./routes/Account";
import { Members } from "./routes/frontdesk/Members";
import { CheckIn } from "./routes/frontdesk/CheckIn";
import { DropIn } from "./routes/frontdesk/DropIn";
import { Bookings } from "./routes/frontdesk/Bookings";


// Screens most people never open load on demand, keeping the first download small.
function lazyNamed<T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T) {
  return lazy(async () => ({ default: (await load())[name] as ComponentType }));
}
const Welcome = lazyNamed(() => import("./routes/Welcome"), "Welcome");
const ForgotPassword = lazyNamed(() => import("./routes/ForgotPassword"), "ForgotPassword");
const ResetPassword = lazyNamed(() => import("./routes/ResetPassword"), "ResetPassword");
const CoachesOverview = lazyNamed(() => import("./routes/CoachesOverview"), "CoachesOverview");
const CoachDetail = lazyNamed(() => import("./routes/CoachDetail"), "CoachDetail");
const Manage = lazyNamed(() => import("./routes/Manage"), "Manage");
const Pay = lazyNamed(() => import("./routes/Pay"), "Pay");
const PayeeDetail = lazyNamed(() => import("./routes/PayeeDetail"), "PayeeDetail");
const History = lazyNamed(() => import("./routes/History"), "History");
const Clients = lazyNamed(() => import("./routes/Clients"), "Clients");
const Invitations = lazyNamed(() => import("./routes/frontdesk/Invitations"), "Invitations");
const DeskClasses = lazyNamed(() => import("./routes/frontdesk/DeskClasses"), "DeskClasses");
const AccountProfile = lazyNamed(() => import("./routes/AccountProfile"), "AccountProfile");
const AccountPassword = lazyNamed(() => import("./routes/AccountPassword"), "AccountPassword");
const OpsShell = lazyNamed(() => import("./routes/ops/OpsShell"), "OpsShell");
const OpsOverview = lazyNamed(() => import("./routes/ops/Overview"), "Overview");
const OpsOrgDetail = lazyNamed(() => import("./routes/ops/OrgDetail"), "OrgDetail");
const OpsOrgQr = lazyNamed(() => import("./routes/ops/OrgQr"), "OrgQr");
const OpsTeam = lazyNamed(() => import("./routes/ops/Team"), "Team");
const OpsPlans = lazyNamed(() => import("./routes/ops/Plans"), "Plans");

export default function App() {
  useEffect(() => {
    initSquirclePolyfill();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <HeaderProvider>
          <OwnMonthProvider>
            <LaunchGate>
            <Suspense fallback={<Spinner />}>
            <Routes>
              <Route path="/welcome" element={<Welcome />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Bizqwik ops dashboard — bizqwik_team only, outside the org shell. */}
              <Route element={<RequireBizqwikTeam />}>
                <Route element={<OpsShell />}>
                  <Route path="/bizqwik" element={<OpsOverview />} />
                  <Route path="/bizqwik/orgs/:id" element={<OpsOrgDetail />} />
                  <Route path="/bizqwik/orgs/:id/qr" element={<OpsOrgQr />} />
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
                    <Route element={<RequireTeam />}>
                      <Route path="/history" element={<History />} />
                    </Route>
                  </Route>

                  <Route element={<RequireDesk />}>
                    <Route path="/members" element={<Members />} />
                    <Route path="/checkin" element={<CheckIn />} />
                    <Route path="/drop-in" element={<DropIn />} />
                    <Route path="/invitations" element={<Invitations />} />
                    <Route path="/bookings" element={<Bookings />} />
                    <Route path="/desk-classes" element={<DeskClasses />} />
                  </Route>

                  <Route element={<RequireRole roles={["head_coach", "dept_head"]} />}>
                    <Route element={<RequireTeam />}>
                      <Route path="/coaches" element={<CoachesOverview />} />
                      <Route path="/coaches/:id" element={<CoachDetail />} />
                    </Route>
                  </Route>

                  <Route element={<RequireRole roles={["coach", "head_coach", "dept_head"]} />}>
                    <Route element={<RequireTeam />}>
                      <Route path="/clients" element={<Clients />} />
                    </Route>
                  </Route>

                  <Route element={<RequireRole roles={["dept_head", "front_desk"]} />}>
                    <Route path="/activity" element={<Activity />} />
                  </Route>

                  <Route element={<RequireRole roles={["dept_head"]} />}>
                    <Route path="/money" element={<Money />} />
                    <Route element={<RequireTeam />}>
                      <Route path="/oversight" element={<Oversight />} />
                    </Route>
                    <Route path="/classes" element={<ClassesManage />} />
                    <Route element={<RequireTeam />}>
                      <Route path="/manage" element={<Manage />} />
                    </Route>
                    <Route path="/catalog" element={<Catalog />} />
                  </Route>

                  <Route element={<RequireRole roles={["accountant"]} />}>
                    <Route path="/pay" element={<Pay />} />
                    <Route path="/pay/:coachId" element={<PayeeDetail />} />
                    <Route path="/revenue" element={<Oversight />} />
                    <Route path="/transactions" element={<Transactions />} />
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            </Suspense>
            </LaunchGate>
          </OwnMonthProvider>
        </HeaderProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

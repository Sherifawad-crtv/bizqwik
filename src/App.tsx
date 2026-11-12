import { Suspense, lazy, useEffect, type ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { HeaderProvider } from "./lib/header";
import { OwnMonthProvider } from "./lib/ownMonth";
import { RequireAuth, RequireRole, RequireBizqwikTeam, RequireDesk, RequireTeam } from "./lib/guards";
import { Spinner } from "./components/Spinner";
import { Shell } from "./components/Shell";
import { Login } from "./routes/Login";
import { Signup } from "./routes/Signup";
import { Home } from "./routes/Home";
import { Account } from "./routes/Account";
import { Oversight } from "./routes/Oversight";
import { Money } from "./routes/Money";
import { Activity, Transactions } from "./routes/Activity";
import { Catalog } from "./routes/Catalog";
import { Accounting } from "./routes/Accounting";
import { Pay } from "./routes/Pay";
import { History } from "./routes/History";
import { Clients } from "./routes/Clients";
import { CoachesOverview } from "./routes/CoachesOverview";
import { Members } from "./routes/frontdesk/Members";
import { CheckIn } from "./routes/frontdesk/CheckIn";
import { DropIn } from "./routes/frontdesk/DropIn";
import { Bookings } from "./routes/frontdesk/Bookings";
import { Invitations } from "./routes/frontdesk/Invitations";
import { ClassesManage } from "./routes/ClassesManage";
import { isChunkLoadError, reloadForUpdate } from "./lib/chunkReload";

import { LaunchGate } from "./components/Splash";


// Screens most people never open load on demand, keeping the first download small.
// If one can't be downloaded because the app was updated while it was open, the
// page reloads once to get the new version; the spinner stays up meanwhile.
function lazyNamed<T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T) {
  return lazy(async () => {
    try {
      return { default: (await load())[name] as ComponentType };
    } catch (err) {
      if (isChunkLoadError(err) && reloadForUpdate()) return new Promise<never>(() => {});
      throw err;
    }
  });
}
const Welcome = lazyNamed(() => import("./routes/Welcome"), "Welcome");
const ForgotPassword = lazyNamed(() => import("./routes/ForgotPassword"), "ForgotPassword");
const ResetPassword = lazyNamed(() => import("./routes/ResetPassword"), "ResetPassword");
const CoachDetail = lazyNamed(() => import("./routes/CoachDetail"), "CoachDetail");
const Manage = lazyNamed(() => import("./routes/Manage"), "Manage");
const PayeeDetail = lazyNamed(() => import("./routes/PayeeDetail"), "PayeeDetail");
const DeskClasses = lazyNamed(() => import("./routes/frontdesk/DeskClasses"), "DeskClasses");
const AccountProfile = lazyNamed(() => import("./routes/AccountProfile"), "AccountProfile");
const AccountPassword = lazyNamed(() => import("./routes/AccountPassword"), "AccountPassword");
const OpsShell = lazyNamed(() => import("./routes/ops/OpsShell"), "OpsShell");
const OpsOverview = lazyNamed(() => import("./routes/ops/Overview"), "Overview");
const OpsOrgDetail = lazyNamed(() => import("./routes/ops/OrgDetail"), "OrgDetail");
const OpsOrgQr = lazyNamed(() => import("./routes/ops/OrgQr"), "OrgQr");
const OpsTeam = lazyNamed(() => import("./routes/ops/Team"), "Team");
const OpsPlans = lazyNamed(() => import("./routes/ops/Plans"), "Plans");

// Every screen in a tab bar loads up front, so a tab tap never waits on a
// download. The rest (detail pages, settings, sign-up) load on demand; once
// the phone is idle they are fetched quietly too.
const warmed = { done: false };
function WarmScreens() {
  const { profile } = useAuth();
  useEffect(() => {
    if (!profile || warmed.done) return;
    warmed.done = true;
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    const run = () => {
      for (const load of [
        () => import("./routes/CoachDetail"), () => import("./routes/PayeeDetail"), () => import("./routes/Manage"),
        () => import("./routes/frontdesk/DeskClasses"),
        () => import("./routes/AccountProfile"), () => import("./routes/AccountPassword"),
      ]) load().catch(() => {});
    };
    if (w.requestIdleCallback) w.requestIdleCallback(run, { timeout: 6000 });
    else setTimeout(run, 3000);
  }, [profile]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HeaderProvider>
          <OwnMonthProvider>
            <LaunchGate>
            <WarmScreens />
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

                  {/* Owner and accountant only (spec: "Coaches, head coaches and
                      front desk cannot see the P&L"). Not its own bottom-nav tab
                      for dept_head — she's already at the 5-tab cap, so she
                      drills in from Overview; accountant has room for a 5th. */}
                  <Route element={<RequireRole roles={["dept_head", "accountant"]} />}>
                    <Route path="/accounting" element={<Accounting />} />
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

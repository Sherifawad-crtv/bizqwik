import { Suspense, lazy, useEffect, type ComponentType } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../shared/auth";
import { HeaderProvider } from "../shared/screen/header";
import { OwnMonthProvider } from "../shared/ownMonth";
import { FloatingActionsProvider, BackActionProvider } from "../shared/screen/floatingActions";
import { RequireAuth, RequireRole, RequireBizqwikTeam, RequireDesk, RequireTeam } from "./guards";
import { Spinner } from "../design-system/components/Spinner";
import { Shell } from "./Shell";
import { Login, Signup } from "../features/auth";
import { Home } from "./Home";
import { Account } from "../features/account";
import { Activity, Money, Oversight, Transactions } from "../features/money";
import { Catalog } from "../features/catalog";
import { Accounting } from "../features/accounting";
import { CoachesOverview, History, Pay } from "../features/coaches";
import { Bookings, CheckIn, DropIn, Invitations, Members } from "../features/frontdesk";
import { Clients } from "../features/clients";
import { ClassesManage } from "../features/classes";
import { isChunkLoadError, reloadForUpdate } from "./chunkReload";

import { LaunchGate } from "./Splash";


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
const Welcome = lazyNamed(() => import("../features/auth/routes/Welcome"), "Welcome");
const ForgotPassword = lazyNamed(() => import("../features/auth/routes/ForgotPassword"), "ForgotPassword");
const ResetPassword = lazyNamed(() => import("../features/auth/routes/ResetPassword"), "ResetPassword");
const CoachDetail = lazyNamed(() => import("../features/coaches/routes/CoachDetail"), "CoachDetail");
const Manage = lazyNamed(() => import("../features/manage/routes/Manage"), "Manage");
const PayeeDetail = lazyNamed(() => import("../features/coaches/routes/PayeeDetail"), "PayeeDetail");
const DeskClasses = lazyNamed(() => import("../features/frontdesk/routes/DeskClasses"), "DeskClasses");
const AccountProfile = lazyNamed(() => import("../features/account/routes/AccountProfile"), "AccountProfile");
const AccountPassword = lazyNamed(() => import("../features/account/routes/AccountPassword"), "AccountPassword");
const OpsShell = lazyNamed(() => import("../features/ops/routes/OpsShell"), "OpsShell");
const OpsOverview = lazyNamed(() => import("../features/ops/routes/Overview"), "Overview");
const OpsOrgDetail = lazyNamed(() => import("../features/ops/routes/OrgDetail"), "OrgDetail");
const OpsOrgQr = lazyNamed(() => import("../features/ops/routes/OrgQr"), "OrgQr");
const OpsTeam = lazyNamed(() => import("../features/ops/routes/Team"), "Team");
const OpsPlans = lazyNamed(() => import("../features/ops/routes/Plans"), "Plans");

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
        () => import("../features/coaches/routes/CoachDetail"), () => import("../features/coaches/routes/PayeeDetail"), () => import("../features/manage/routes/Manage"),
        () => import("../features/frontdesk/routes/DeskClasses"),
        () => import("../features/account/routes/AccountProfile"), () => import("../features/account/routes/AccountPassword"),
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
            <FloatingActionsProvider>
            <BackActionProvider>
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
            </BackActionProvider>
            </FloatingActionsProvider>
          </OwnMonthProvider>
        </HeaderProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

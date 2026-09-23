import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { HeaderProvider } from "./lib/header";
import { OwnMonthProvider } from "./lib/ownMonth";
import { RequireAuth, RequireRole } from "./lib/guards";
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
import { Spinner } from "./components/Spinner";

// Front-desk screens are split out: the QR scanner library is large and no
// other role should download it.
const Members = lazy(() => import("./routes/frontdesk/Members").then((m) => ({ default: m.Members })));
const CheckIn = lazy(() => import("./routes/frontdesk/CheckIn").then((m) => ({ default: m.CheckIn })));
const DropIn = lazy(() => import("./routes/frontdesk/DropIn").then((m) => ({ default: m.DropIn })));
const Invitations = lazy(() => import("./routes/frontdesk/Invitations").then((m) => ({ default: m.Invitations })));
const lazyScreen = (node: ReactNode) => <Suspense fallback={<Spinner />}>{node}</Suspense>;

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
                    <Route path="/members" element={lazyScreen(<Members />)} />
                    <Route path="/checkin" element={lazyScreen(<CheckIn />)} />
                    <Route path="/drop-in" element={lazyScreen(<DropIn />)} />
                    <Route path="/invitations" element={lazyScreen(<Invitations />)} />
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

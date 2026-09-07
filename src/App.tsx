import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { HeaderProvider } from "./lib/header";
import { OwnMonthProvider } from "./lib/ownMonth";
import { RequireAuth, RequireRole } from "./lib/guards";
import { Shell } from "./components/Shell";

import { Login } from "./routes/Login";
import { Home } from "./routes/Home";
import { CoachesOverview } from "./routes/CoachesOverview";
import { CoachDetail } from "./routes/CoachDetail";
import { Oversight } from "./routes/Oversight";
import { Manage } from "./routes/Manage";
import { Pay } from "./routes/Pay";
import { PayHistory } from "./routes/PayHistory";
import { Account } from "./routes/Account";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HeaderProvider>
          <OwnMonthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route element={<RequireAuth />}>
                <Route element={<Shell />}>
                  <Route path="/" element={<Home />} />
                  <Route path="/account" element={<Account />} />

                  <Route element={<RequireRole roles={["head_coach", "dept_head"]} />}>
                    <Route path="/coaches" element={<CoachesOverview />} />
                    <Route path="/coaches/:id" element={<CoachDetail />} />
                  </Route>

                  <Route element={<RequireRole roles={["dept_head"]} />}>
                    <Route path="/oversight" element={<Oversight />} />
                    <Route path="/manage" element={<Manage />} />
                  </Route>

                  <Route element={<RequireRole roles={["accountant"]} />}>
                    <Route path="/pay" element={<Pay />} />
                    <Route path="/history" element={<PayHistory />} />
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

import { clearAsyncCache } from "./useAsync";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { markWelcomed } from "./welcome";
import { api, auth as authApi } from "./backend";
import { autoEnablePushIfPossible } from "./push";
import type { BizqwikTeam, Profile, Tier } from "./types";

interface AuthState {
  profile: Profile | null;
  tier: Tier | null;
  // "solo": the owner runs everything herself (simpler app); "team": today's app.
  orgMode: "solo" | "team";
  // Set when the signed-in account is a Bizqwik-team member (ops dashboard).
  // A pure team member has no profile; an org user has no bizqwikTeam.
  bizqwikTeam: BizqwikTeam | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [orgMode, setOrgMode] = useState<"solo" | "team">("team");
  const [bizqwikTeam, setBizqwikTeam] = useState<BizqwikTeam | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setProfile(me.profile);
        setTier(me.tier);
        setOrgMode(me.orgMode === "solo" ? "solo" : "team");
        setBizqwikTeam(me.bizqwikTeam);
      })
      .catch(() => {
        setProfile(null);
        setTier(null);
        setBizqwikTeam(null);
      })
      .finally(() => setReady(true));
  }, []);

  // Anyone who has ever signed in on this device has "been welcomed", so a
  // later sign-out lands on the regular sign-in page, not the first-time screen.
  useEffect(() => {
    if (profile || bizqwikTeam) markWelcomed();
  }, [profile, bizqwikTeam]);

  // Turns push on the moment we know who's signed in — on initial load and
  // right after login — so notifications start flowing without anyone
  // having to find the Account screen toggle.
  useEffect(() => {
    if (profile) autoEnablePushIfPossible();
  }, [profile?.id]);

  const login = async (email: string, password: string) => {
    await authApi.signInWithPassword(email, password);
    clearAsyncCache();
    const me = await api.me();
    setProfile(me.profile);
    setTier(me.tier);
    setOrgMode(me.orgMode === "solo" ? "solo" : "team");
    setBizqwikTeam(me.bizqwikTeam);
  };

  const logout = async () => {
    await authApi.signOut();
    clearAsyncCache();
    setProfile(null);
    setTier(null);
    setOrgMode("team");
    setBizqwikTeam(null);
  };

  const refreshProfile = async () => {
    const me = await api.me();
    setProfile(me.profile);
    setTier(me.tier);
    setOrgMode(me.orgMode === "solo" ? "solo" : "team");
    setBizqwikTeam(me.bizqwikTeam);
  };

  return <AuthContext.Provider value={{ profile, tier, orgMode, bizqwikTeam, ready, login, logout, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

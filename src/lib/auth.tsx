import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, auth as authApi } from "./backend";
import { autoEnablePushIfPossible } from "./push";
import type { BizqwikTeam, Profile, Tier } from "./types";

interface AuthState {
  profile: Profile | null;
  tier: Tier | null;
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
  const [bizqwikTeam, setBizqwikTeam] = useState<BizqwikTeam | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setProfile(me.profile);
        setTier(me.tier);
        setBizqwikTeam(me.bizqwikTeam);
      })
      .catch(() => {
        setProfile(null);
        setTier(null);
        setBizqwikTeam(null);
      })
      .finally(() => setReady(true));
  }, []);

  // Turns push on the moment we know who's signed in — on initial load and
  // right after login — so notifications start flowing without anyone
  // having to find the Account screen toggle.
  useEffect(() => {
    if (profile) autoEnablePushIfPossible();
  }, [profile?.id]);

  const login = async (email: string, password: string) => {
    await authApi.signInWithPassword(email, password);
    const me = await api.me();
    setProfile(me.profile);
    setTier(me.tier);
    setBizqwikTeam(me.bizqwikTeam);
  };

  const logout = async () => {
    await authApi.signOut();
    setProfile(null);
    setTier(null);
    setBizqwikTeam(null);
  };

  const refreshProfile = async () => {
    const me = await api.me();
    setProfile(me.profile);
    setTier(me.tier);
    setBizqwikTeam(me.bizqwikTeam);
  };

  return <AuthContext.Provider value={{ profile, tier, bizqwikTeam, ready, login, logout, refreshProfile }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

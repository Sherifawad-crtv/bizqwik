import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, auth as authApi } from "./backend";
import type { Profile, Tier } from "./types";

interface AuthState {
  profile: Profile | null;
  tier: Tier | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tier, setTier] = useState<Tier | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api
      .me()
      .then((me) => {
        setProfile(me.profile);
        setTier(me.tier);
      })
      .catch(() => {
        setProfile(null);
        setTier(null);
      })
      .finally(() => setReady(true));
  }, []);

  const login = async (email: string, password: string) => {
    await authApi.signInWithPassword(email, password);
    const me = await api.me();
    setProfile(me.profile);
    setTier(me.tier);
  };

  const logout = async () => {
    await authApi.signOut();
    setProfile(null);
    setTier(null);
  };

  return <AuthContext.Provider value={{ profile, tier, ready, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiAuth } from "@/api";
import { auth as authClient, ApiError } from "@/api/client";
import type { Profile } from "@/types";

interface AuthState {
  me: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: Parameters<typeof apiAuth.register>[0]) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setMe(await apiAuth.me());
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await authClient.login(email, password);
    setMe(await apiAuth.me());
  }, []);

  const register = useCallback(async (payload: Parameters<typeof apiAuth.register>[0]) => {
    await apiAuth.register(payload);
    await authClient.login(payload.email, payload.password);
    setMe(await apiAuth.me());
  }, []);

  const logout = useCallback(async () => {
    await authClient.logout();
    setMe(null);
  }, []);

  useEffect(() => {
    // The access token lives only in memory, so after a reload trade the refresh cookie for one.
    // `loading` stays true until this settles, so route guards do not redirect too early.
    authClient.restore().then((ok) => {
      if (ok) return refresh();
      setMe(null);
      setLoading(false);
    });
    const onLogout = () => setMe(null);
    window.addEventListener("lb:logout", onLogout);
    return () => window.removeEventListener("lb:logout", onLogout);
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ me, loading, login, register, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

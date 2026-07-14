import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { AuthState } from "./types";

const STORAGE_KEY = "amanax.auth";

interface AuthContextValue {
  auth: AuthState | null;
  setAuth: (auth: AuthState) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredAuth(): AuthState | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthState;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuthState] = useState<AuthState | null>(loadStoredAuth);

  const value = useMemo<AuthContextValue>(
    () => ({
      auth,
      setAuth: (next) => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        setAuthState(next);
      },
      logout: () => {
        localStorage.removeItem(STORAGE_KEY);
        setAuthState(null);
      },
    }),
    [auth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

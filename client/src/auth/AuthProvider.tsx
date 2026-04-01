import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type SessionUser = {
  uid: number;
  tenantId: number;
  role: string;
};

type LoginResult = {
  success: boolean;
  token: string;
  user: {
    id: number;
    email: string;
    role: string;
    tenantId: number;
  };
};

type AuthContextValue = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: SessionUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<SessionUser | null>(null);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/auth/session", { credentials: "include" });
      if (!res.ok) {
        setIsAuthenticated(false);
        setUser(null);
        return;
      }
      const data = await res.json();
      setIsAuthenticated(Boolean(data?.authenticated));
      setUser(data?.user ?? null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    const data: LoginResult | { error?: string } = await res.json();
    if (!res.ok) {
      throw new Error((data as { error?: string }).error || "Login failed");
    }

    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    await refreshSession();
  }, [refreshSession]);

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    await refreshSession();
  }, [refreshSession]);

  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated,
    isLoading,
    user,
    login,
    logout,
    refreshSession,
  }), [isAuthenticated, isLoading, login, logout, refreshSession, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation } from "react-router-dom";
import type { StaffPermissions } from "../../../shared/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

export type PinUser = {
  id: number;
  name: string;
  role: string;
  permissions: StaffPermissions;
};

type StaffListUser = { id: number; name: string; role: string };

// ─── Auth Context ────────────────────────────────────────────────────────────

type PinAuthContextValue = {
  currentUser: PinUser | null;
  logout: () => Promise<void>;
  hasPermission: (key: keyof StaffPermissions) => boolean;
};

const PinAuthContext = createContext<PinAuthContextValue>({
  currentUser: null,
  logout: async () => {},
  hasPermission: () => false,
});

export function usePinAuth() {
  return useContext(PinAuthContext);
}

// ─── Public path bypass ───────────────────────────────────────────────────────

const PUBLIC_PATH_PREFIXES = ["/website", "/order", "/login", "/pos-login"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

// ─── Main gate component ─────────────────────────────────────────────────────

export default function PinLoginGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [gateState, setGateState] = useState<"loading" | "locked" | "unlocked">("loading");
  const [currentUser, setCurrentUser] = useState<PinUser | null>(null);

  const isPublic = isPublicPath(location.pathname);

  const checkSession = useCallback(async () => {
    if (isPublic) { setGateState("unlocked"); return; }
    const forcePin = new URLSearchParams(window.location.search).get("lock") === "1";
    if (process.env.NODE_ENV === "development" && !forcePin) {
      // Dev bypass: auto-unlock with a synthetic owner
      setCurrentUser({
        id: 0,
        name: "Dev Owner",
        role: "owner",
        permissions: Object.fromEntries(
          ["dashboard.view","operations.view","purchasing.view","analysis.view",
           "finance.view","menu.view","pos.view","membership.view","forms.daily_sales",
           "forms.daily_stock","expenses.view","settings.view","staff_access.manage",
           "website_admin.view","online_ordering_admin.view"].map((k) => [k, true])
        ) as StaffPermissions,
      });
      setGateState("unlocked");
      return;
    }
    try {
      const res = await fetch("/api/pin-auth/me", { credentials: "include" });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
        setGateState("unlocked");
      } else {
        setCurrentUser(null);
        setGateState("locked");
      }
    } catch {
      setGateState("locked");
    }
  }, [isPublic]);

  useEffect(() => { checkSession(); }, [checkSession]);

  const logout = useCallback(async () => {
    await fetch("/api/pin-auth/logout", { method: "POST", credentials: "include" });
    setCurrentUser(null);
    setGateState("locked");
  }, []);

  const hasPermission = useCallback(
    (key: keyof StaffPermissions) => {
      if (!currentUser) return false;
      if (currentUser.role === "owner") return true;
      return currentUser.permissions[key] === true;
    },
    [currentUser]
  );

  const contextValue: PinAuthContextValue = { currentUser, logout, hasPermission };

  if (gateState === "loading" && !isPublic) {
    return (
      <PinAuthContext.Provider value={contextValue}>
        <div className="fixed inset-0 z-[9999]" style={{ background: "hsl(222,47%,4%)" }} />
      </PinAuthContext.Provider>
    );
  }

  if (gateState === "locked" && !isPublic) {
    return (
      <PinAuthContext.Provider value={contextValue}>
        <PinLoginScreen
          onLogin={(user) => {
            setCurrentUser(user);
            setGateState("unlocked");
          }}
        />
      </PinAuthContext.Provider>
    );
  }

  return (
    <PinAuthContext.Provider value={contextValue}>
      {children}
    </PinAuthContext.Provider>
  );
}

// ─── PIN Login Screen ────────────────────────────────────────────────────────

const MAX_PIN_LENGTH = 8;

function PinLoginScreen({ onLogin }: { onLogin: (user: PinUser) => void }) {
  const [staffUsers, setStaffUsers] = useState<StaffListUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<StaffListUser | null>(null);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/pin-auth/users", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setStaffUsers(data.users ?? []))
      .catch(() => setStaffUsers([]));
  }, []);

  // Hardware keyboard support
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!selectedUser) return;
      if (e.key >= "0" && e.key <= "9") {
        appendDigit(e.key);
      } else if (e.key === "Backspace") {
        setPin((p) => p.slice(0, -1));
        setStatus("idle");
        setErrorMsg("");
      } else if (e.key === "Enter") {
        submitPin();
      } else if (e.key === "Escape") {
        setSelectedUser(null);
        setPin("");
        setStatus("idle");
        setErrorMsg("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function appendDigit(d: string) {
    if (pin.length >= MAX_PIN_LENGTH) return;
    setStatus("idle");
    setErrorMsg("");
    setPin((p) => p + d);
  }

  async function submitPin() {
    if (!selectedUser || pin.length < 4) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/pin-auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, pin }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onLogin(data.user);
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Incorrect PIN");
        setPin("");
        setShake(true);
        setTimeout(() => setShake(false), 600);
      }
    } catch {
      setStatus("error");
      setErrorMsg("Connection error. Try again.");
      setPin("");
    }
  }

  // Auto-submit when max PIN length reached or on Enter-like patterns
  useEffect(() => {
    if (pin.length === 6 && selectedUser) {
      submitPin();
    }
  }, [pin]);

  const KEYPAD = [
    ["1","2","3"],
    ["4","5","6"],
    ["7","8","9"],
    ["⌫","0","✓"],
  ];

  const bg = "hsl(222,47%,4%)";
  const surface = "hsl(222,35%,8%)";
  const surfaceBorder = "hsl(222,30%,14%)";
  const accent = "hsl(142,76%,45%)";
  const muted = "hsl(215,16%,55%)";
  const textPrimary = "hsl(213,31%,91%)";

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] overflow-y-auto"
      style={{ background: bg, fontFamily: "'Poppins', 'Inter', system-ui, sans-serif" }}
    >
      <div className="min-h-full flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-sm">

          {/* ── Brand header ───────────────────────────────────── */}
          <div className="mb-8 text-center">
            <p
              className="text-xs font-bold tracking-[0.2em] uppercase"
              style={{ color: accent }}
            >
              Smash Brothers
            </p>
            <h1
              className="mt-1 text-2xl font-bold tracking-tight"
              style={{ color: textPrimary }}
            >
              Staff Access
            </h1>
            <p className="mt-1 text-xs" style={{ color: muted }}>
              {selectedUser ? `Enter PIN for ${selectedUser.name}` : "Select your name to sign in"}
            </p>
          </div>

          {/* ── User selection cards ────────────────────────────── */}
          {!selectedUser && (
            <div className="mb-6">
              {staffUsers.length === 0 ? (
                <div
                  className="rounded-lg p-6 text-center text-sm"
                  style={{ background: surface, border: `1px solid ${surfaceBorder}`, color: muted }}
                >
                  No staff accounts configured.
                  <br />
                  <span className="text-xs">Contact your manager to set up access.</span>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {staffUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => { setSelectedUser(u); setPin(""); setStatus("idle"); setErrorMsg(""); }}
                      className="rounded-xl py-4 px-3 text-left transition-all duration-150 active:scale-95"
                      style={{
                        background: surface,
                        border: `1px solid ${surfaceBorder}`,
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = accent;
                        (e.currentTarget as HTMLButtonElement).style.background = "hsl(222,35%,11%)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = surfaceBorder;
                        (e.currentTarget as HTMLButtonElement).style.background = surface;
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mb-2"
                        style={{ background: "hsl(222,35%,14%)", color: accent }}
                      >
                        {u.name.slice(0, 1).toUpperCase()}
                      </div>
                      <p className="text-sm font-semibold leading-tight" style={{ color: textPrimary }}>
                        {u.name}
                      </p>
                      <p className="text-xs capitalize mt-0.5" style={{ color: muted }}>
                        {u.role}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PIN entry + keypad ──────────────────────────────── */}
          {selectedUser && (
            <div>
              {/* Selected user indicator */}
              <div className="flex items-center gap-2 mb-5">
                <button
                  onClick={() => { setSelectedUser(null); setPin(""); setStatus("idle"); setErrorMsg(""); }}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs transition-opacity hover:opacity-70"
                  style={{ background: "hsl(222,35%,11%)", color: muted }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: "hsl(222,35%,14%)", color: accent }}
                  >
                    {selectedUser.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: textPrimary }}>
                    {selectedUser.name}
                  </span>
                </div>
              </div>

              {/* PIN dots */}
              <div
                className={`rounded-xl p-5 mb-4 flex items-center justify-center gap-3 transition-all ${shake ? "animate-shake" : ""}`}
                style={{ background: surface, border: `1px solid ${status === "error" ? "hsl(0,70%,45%)" : surfaceBorder}` }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-150"
                    style={{
                      width: i < pin.length ? 14 : 10,
                      height: i < pin.length ? 14 : 10,
                      background: i < pin.length
                        ? (status === "error" ? "hsl(0,70%,55%)" : accent)
                        : "hsl(222,30%,20%)",
                    }}
                  />
                ))}
              </div>

              {/* Error message */}
              <div className="h-6 mb-3 text-center">
                {status === "error" && errorMsg && (
                  <p className="text-xs font-medium" style={{ color: "hsl(0,70%,65%)" }}>
                    {errorMsg}
                  </p>
                )}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {KEYPAD.flat().map((key) => {
                  const isDelete = key === "⌫";
                  const isSubmit = key === "✓";
                  const isSubmitDisabled = isSubmit && pin.length < 4;
                  const isLoading = status === "loading";

                  return (
                    <button
                      key={key}
                      disabled={isLoading || (isSubmit && pin.length < 4)}
                      onClick={() => {
                        if (isLoading) return;
                        if (isDelete) {
                          setPin((p) => p.slice(0, -1));
                          setStatus("idle");
                          setErrorMsg("");
                        } else if (isSubmit) {
                          submitPin();
                        } else {
                          appendDigit(key);
                        }
                      }}
                      className="rounded-xl text-lg font-semibold h-16 flex items-center justify-center transition-all duration-100 select-none active:scale-95 disabled:opacity-30"
                      style={{
                        background: isSubmit
                          ? (pin.length >= 4 ? accent : "hsl(222,35%,12%)")
                          : isDelete
                          ? "hsl(222,35%,12%)"
                          : "hsl(222,35%,10%)",
                        color: isSubmit && pin.length >= 4 ? "hsl(222,47%,6%)" : textPrimary,
                        border: `1px solid ${isSubmit && pin.length >= 4 ? accent : surfaceBorder}`,
                        fontWeight: isSubmit || isDelete ? 600 : 400,
                        fontSize: isDelete || isSubmit ? "1.1rem" : "1.25rem",
                      }}
                      onMouseEnter={(e) => {
                        if (!isLoading && !isSubmitDisabled) {
                          const btn = e.currentTarget as HTMLButtonElement;
                          if (!isSubmit) btn.style.background = "hsl(222,35%,16%)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        const btn = e.currentTarget as HTMLButtonElement;
                        if (isSubmit && pin.length >= 4) btn.style.background = accent;
                        else if (isDelete) btn.style.background = "hsl(222,35%,12%)";
                        else btn.style.background = "hsl(222,35%,10%)";
                      }}
                    >
                      {isLoading && isSubmit ? (
                        <div
                          className="w-4 h-4 rounded-full border-2 animate-spin"
                          style={{ borderColor: "hsl(222,47%,6%) transparent transparent transparent" }}
                        />
                      ) : key}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Footer ─────────────────────────────────────────── */}
          <p className="mt-8 text-center text-xs" style={{ color: "hsl(222,30%,28%)" }}>
            Smash Brothers Burgers — Internal System
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}

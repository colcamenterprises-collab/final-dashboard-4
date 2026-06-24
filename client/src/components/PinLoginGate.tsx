import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

const PUBLIC_EXACT_PATHS = new Set([
  "/",
  "/menu",
  "/membership",
  "/staff",
  "/pos-login",
]);

const PUBLIC_PATH_PREFIXES = [
  "/website",
  "/order",
  "/online-ordering",
  "/ordering/tablet",
  "/kitchen/display",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.has(pathname)) return true;
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

    // Always check the real session first — so logged-in users see their actual name
    try {
      const res = await fetch("/api/pin-auth/me", { credentials: "include" });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setCurrentUser(data.user);
        setGateState("unlocked");
        return;
      }
    } catch {}

    // Dev bypass — only when no real session exists and not force-locked
    if (process.env.NODE_ENV === "development" && !forcePin) {
      setCurrentUser({
        id: 1,
        name: "Cam",
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

    setCurrentUser(null);
    setGateState("locked");
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
        <div className="fixed inset-0 z-[9999] bg-white" />
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

const PIN_LENGTH = 4;

const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
];

function PinLoginScreen({ onLogin }: { onLogin: (user: PinUser) => void }) {
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

  // Hardware keyboard support for PIN entry when focus is not in the username field
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "INPUT") return;
      if (e.key >= "0" && e.key <= "9") appendDigit(e.key);
      else if (e.key === "Backspace") deleteDigit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  function appendDigit(d: string) {
    if (pin.length >= PIN_LENGTH) return;
    setStatus("idle");
    setErrorMsg("");
    setPin((p) => p + d);
  }

  function deleteDigit() {
    setPin((p) => p.slice(0, -1));
    setStatus("idle");
    setErrorMsg("");
  }

  async function submitLogin(e?: React.FormEvent) {
    e?.preventDefault();
    if (!username.trim() || pin.length < PIN_LENGTH || status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/pin-auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), pin }),
      });
      const data = await res.json();
      if (res.ok && data.user) {
        onLogin(data.user);
      } else {
        setStatus("error");
        setErrorMsg(data.error || "Incorrect PIN");
        setPin("");
        setShake(true);
        setTimeout(() => setShake(false), 500);
      }
    } catch {
      setStatus("error");
      setErrorMsg("Connection error. Try again.");
      setPin("");
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] bg-white overflow-y-auto"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-xs sm:max-w-sm">

          {/* Brand header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-1.5 mb-3">
              <span className="text-xs font-bold tracking-widest text-emerald-600 uppercase">
                Smash Brothers
              </span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Staff Sign In
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Enter your username/name and PIN
            </p>
          </div>

          <form onSubmit={submitLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Username or name
              </label>
              <input
                type="text"
                autoFocus
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter staff username or name"
                className="w-full h-11 rounded-lg border border-gray-200 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-3 text-center">
                PIN / passcode
              </label>
              <div className={`flex items-center justify-center gap-4 mb-2 ${shake ? "animate-shake" : ""}`}>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-full transition-all duration-150"
                    style={{
                      width: i < pin.length ? 16 : 12,
                      height: i < pin.length ? 16 : 12,
                      background: i < pin.length
                        ? (status === "error" ? "#ef4444" : "#10b981")
                        : "#e5e7eb",
                    }}
                  />
                ))}
              </div>

              <div className="h-6 mb-5 text-center">
                {status === "error" && errorMsg && (
                  <p className="text-xs text-red-500 font-medium">{errorMsg}</p>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: "10px",
                  width: "100%",
                  maxWidth: "280px",
                  margin: "0 auto",
                }}
              >
                {KEYPAD_ROWS.flat().map((key, idx) => {
                  if (key === "") return <div key={idx} />;
                  const isDelete = key === "⌫";
                  const isLoading = status === "loading";
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isLoading}
                      onClick={() => {
                        if (isLoading) return;
                        if (isDelete) deleteDigit();
                        else appendDigit(key);
                      }}
                      style={{ height: "64px", borderRadius: "6px" }}
                      className={[
                        "flex items-center justify-center select-none transition-all duration-100",
                        "active:scale-95 disabled:opacity-40",
                        isDelete
                          ? "bg-gray-100 text-gray-600 text-lg hover:bg-gray-200"
                          : "bg-gray-50 border border-gray-200 text-gray-900 text-xl font-semibold hover:bg-gray-100 hover:border-gray-300",
                      ].join(" ")}
                    >
                      {isLoading && !isDelete ? (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 border-t-emerald-500 animate-spin" />
                      ) : key}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              disabled={!username.trim() || pin.length < PIN_LENGTH || status === "loading"}
              className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40"
            >
              {status === "loading" ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-10 text-center text-xs text-gray-300">
            Smash Brothers Burgers — Internal System
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .animate-shake { animation: shake 0.45s ease-in-out; }
      `}</style>
    </div>
  );
}

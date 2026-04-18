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

const PUBLIC_PATH_PREFIXES = [
  "/website",
  "/order",
  "/online-ordering",
  "/login",
  "/pos-login",
];

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

type LoginStep = "email" | "pin";

function PinLoginScreen({ onLogin }: { onLogin: (user: PinUser) => void }) {
  const [step, setStep] = useState<LoginStep>("email");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

  // Hardware keyboard support for PIN step
  useEffect(() => {
    if (step !== "pin") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key >= "0" && e.key <= "9") appendDigit(e.key);
      else if (e.key === "Backspace") deleteDigit();
      else if (e.key === "Escape") goBack();
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

  function goBack() {
    setStep("email");
    setPin("");
    setStatus("idle");
    setErrorMsg("");
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStep("pin");
    setPin("");
    setStatus("idle");
    setErrorMsg("");
  }

  async function submitPin(currentPin: string) {
    if (!email || currentPin.length < PIN_LENGTH) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/pin-auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), pin: currentPin }),
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

  // Auto-submit when PIN_LENGTH digits entered
  useEffect(() => {
    if (pin.length === PIN_LENGTH && step === "pin" && status === "idle") {
      submitPin(pin);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

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
              {step === "email" ? "Enter your email, username, or name" : "Enter your PIN"}
            </p>
          </div>

          {/* ── Step 1: Email entry ──────────────────────────────── */}
          {step === "email" && (
            <form onSubmit={submitEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Email, username, or name
                </label>
                <input
                  type="text"
                  autoFocus
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. cparker, cameron@email.com"
                  className="w-full h-11 rounded-lg border border-gray-200 px-4 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={!email.trim()}
                className="w-full h-11 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                Continue
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </form>
          )}

          {/* ── Step 2: PIN entry ─────────────────────────────────── */}
          {step === "pin" && (
            <div>
              {/* Email shown + back link */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={goBack}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700">
                    {email.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-xs text-gray-600 truncate max-w-[160px]">{email}</span>
                </div>
              </div>

              {/* PIN dots */}
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

              {/* Error */}
              <div className="h-6 mb-5 text-center">
                {status === "error" && errorMsg && (
                  <p className="text-xs text-red-500 font-medium">{errorMsg}</p>
                )}
              </div>

              {/* Phone-style keypad */}
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
          )}

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

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

function PinLoginScreen({ onLogin }: { onLogin: (user: PinUser) => void }) {
  const [staffUsers, setStaffUsers] = useState<StaffListUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<StaffListUser | null>(null);
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [shake, setShake] = useState(false);

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
      if (e.key >= "0" && e.key <= "9") appendDigit(e.key);
      else if (e.key === "Backspace") deleteDigit();
      else if (e.key === "Escape") clearUser();
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

  function clearUser() {
    setSelectedUser(null);
    setPin("");
    setStatus("idle");
    setErrorMsg("");
  }

  async function submitPin(currentPin: string) {
    if (!selectedUser || currentPin.length < PIN_LENGTH) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/pin-auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUser.id, pin: currentPin }),
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
    if (pin.length === PIN_LENGTH && selectedUser && status === "idle") {
      submitPin(pin);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const roleLabel = (role: string) =>
    role.charAt(0).toUpperCase() + role.slice(1);

  return (
    <div
      className="fixed inset-0 z-[9999] bg-white overflow-y-auto"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── Centered column — max-w-xs on mobile, max-w-sm on tablet+ ── */}
      <div className="min-h-full flex flex-col items-center justify-center px-6 py-10">
        <div className="w-full max-w-xs sm:max-w-sm">

          {/* ── Brand header ─────────────────────────────────────── */}
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
              {selectedUser
                ? `Enter your 4-digit PIN`
                : "Tap your name to continue"}
            </p>
          </div>

          {/* ── User selection ───────────────────────────────────── */}
          {!selectedUser && (
            <div className="mb-4">
              {staffUsers.length === 0 ? (
                <div className="rounded border border-gray-200 p-6 text-center">
                  <p className="text-sm text-gray-500">No staff accounts configured.</p>
                  <p className="text-xs text-gray-400 mt-1">Contact your manager.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {staffUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => {
                        setSelectedUser(u);
                        setPin("");
                        setStatus("idle");
                        setErrorMsg("");
                      }}
                      className="flex items-center gap-3 w-full rounded border border-gray-200 px-4 py-3 text-left hover:border-emerald-500 hover:bg-emerald-50/40 active:scale-[0.99] transition-all"
                    >
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-700 shrink-0">
                        {u.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{u.name}</p>
                        <p className="text-xs text-gray-400">{roleLabel(u.role)}</p>
                      </div>
                      <svg className="ml-auto text-gray-300 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── PIN entry ────────────────────────────────────────── */}
          {selectedUser && (
            <div>
              {/* Who is signing in */}
              <div className="flex items-center justify-between mb-6">
                <button
                  onClick={clearUser}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  Back
                </button>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-700">
                    {selectedUser.name.slice(0, 1).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{selectedUser.name}</span>
                </div>
              </div>

              {/* PIN dots — 4 circles */}
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
              <div className="grid grid-cols-3 gap-3">
                {KEYPAD_ROWS.flat().map((key, idx) => {
                  if (key === "") {
                    return <div key={idx} />;
                  }
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
                      className={[
                        "h-16 rounded flex items-center justify-center select-none transition-all duration-100",
                        "active:scale-95 disabled:opacity-40",
                        isDelete
                          ? "bg-gray-100 text-gray-600 text-lg hover:bg-gray-200"
                          : "bg-gray-50 border border-gray-200 text-gray-900 text-xl font-medium hover:bg-gray-100 hover:border-gray-300",
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

          {/* ── Footer ───────────────────────────────────────────── */}
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

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

const PUBLIC_PATH_PREFIXES = [
  "/website",
  "/order",
  "/login",
  "/pos-login",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

type UiAuthContextValue = {
  lock: () => Promise<void>;
};

const UiAuthContext = createContext<UiAuthContextValue>({ lock: async () => {} });

export function useUiAuth() {
  return useContext(UiAuthContext);
}

type State = "loading" | "locked" | "unlocked";

export default function UiPasswordGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<State>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notConfigured, setNotConfigured] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isPublic = isPublicPath(location.pathname);

  const check = useCallback(async () => {
    if (isPublic) {
      setState("unlocked");
      return;
    }
    try {
      const res = await fetch("/api/ui-auth/check", { credentials: "include" });
      const data = await res.json();
      if (!data.configured) {
        setNotConfigured(true);
        setState("locked");
      } else {
        setState(data.authenticated ? "unlocked" : "locked");
      }
    } catch {
      setState("locked");
    }
  }, [isPublic]);

  useEffect(() => {
    check();
  }, [check]);

  useEffect(() => {
    if (state === "locked" && !isPublic) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [state, isPublic]);

  const lock = useCallback(async () => {
    await fetch("/api/ui-auth/logout", { method: "POST", credentials: "include" });
    setPassword("");
    setError("");
    setState("locked");
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim()) return;
      setSubmitting(true);
      setError("");
      try {
        const res = await fetch("/api/ui-auth/login", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          setPassword("");
          setState("unlocked");
        } else {
          const data = await res.json();
          setError(data.error || "Incorrect password");
          setPassword("");
          inputRef.current?.focus();
        }
      } catch {
        setError("Connection error. Try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [password]
  );

  if (state === "loading" && !isPublic) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "hsl(222, 47%, 4%)" }}
      />
    );
  }

  if (state === "locked" && !isPublic) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
        style={{ background: "hsl(222, 47%, 4%)", fontFamily: "'Poppins', sans-serif" }}
      >
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8">
            <p
              className="text-xs font-semibold tracking-widest uppercase"
              style={{ color: "hsl(142, 76%, 45%)" }}
            >
              Smash Brothers
            </p>
            <h1
              className="mt-1 text-xl font-bold"
              style={{ color: "hsl(213, 31%, 91%)" }}
            >
              Internal Access
            </h1>
            <p
              className="mt-1 text-xs"
              style={{ color: "hsl(215, 16%, 65%)" }}
            >
              Enter the shared password to continue.
            </p>
          </div>

          {/* Card */}
          <div
            className="rounded p-6"
            style={{
              background: "hsl(222, 47%, 8%)",
              border: "1px solid hsl(215, 28%, 17%)",
            }}
          >
            {notConfigured ? (
              <div
                className="rounded p-4 text-xs"
                style={{
                  background: "hsl(45, 93%, 58%, 0.1)",
                  border: "1px solid hsl(45, 93%, 58%, 0.3)",
                  color: "hsl(45, 93%, 70%)",
                }}
              >
                <p className="font-semibold">Password not configured.</p>
                <p className="mt-1" style={{ color: "hsl(45, 93%, 60%)" }}>
                  Set{" "}
                  <code
                    className="rounded px-1 py-0.5"
                    style={{ background: "hsl(222, 47%, 4%)", fontSize: "11px" }}
                  >
                    INTERNAL_APP_PASSWORD
                  </code>{" "}
                  in environment secrets, then restart the server.
                </p>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <label
                  className="mb-1.5 block text-xs font-semibold"
                  style={{ color: "hsl(215, 16%, 65%)" }}
                >
                  Password
                </label>
                <input
                  ref={inputRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter access password"
                  disabled={submitting}
                  className="w-full rounded px-3 py-2.5 text-sm outline-none transition-colors disabled:opacity-50"
                  style={{
                    background: "hsl(222, 47%, 4%)",
                    border: `1px solid ${error ? "hsl(0, 84%, 60%)" : "hsl(215, 28%, 17%)"}`,
                    color: "hsl(213, 31%, 91%)",
                  }}
                  autoComplete="current-password"
                />
                {error && (
                  <p
                    className="mt-2 text-xs"
                    style={{ color: "hsl(0, 84%, 65%)" }}
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={submitting || !password.trim()}
                  className="mt-4 w-full rounded py-2.5 text-sm font-semibold transition-opacity disabled:opacity-40"
                  style={{
                    background: "hsl(142, 76%, 45%)",
                    color: "hsl(222, 47%, 8%)",
                  }}
                >
                  {submitting ? "Checking..." : "Enter"}
                </button>
              </form>
            )}
          </div>

          <p
            className="mt-6 text-center text-xs"
            style={{ color: "hsl(215, 28%, 25%)" }}
          >
            Management access only
          </p>
        </div>
      </div>
    );
  }

  return (
    <UiAuthContext.Provider value={{ lock }}>
      {children}
    </UiAuthContext.Provider>
  );
}

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
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950">
        <div className="text-sm text-zinc-500">Loading...</div>
      </div>
    );
  }

  if (state === "locked" && !isPublic) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950 px-4">
        <div className="w-full max-w-sm">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Smash Brothers</p>
            <h1 className="mt-1 text-xl font-bold text-white">Internal Access</h1>
          </div>

          {notConfigured ? (
            <div className="rounded border border-yellow-600/40 bg-yellow-900/20 p-4 text-sm text-yellow-300">
              <p className="font-semibold">Password not configured.</p>
              <p className="mt-1 text-yellow-400/80">
                Set{" "}
                <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">
                  INTERNAL_APP_PASSWORD
                </code>{" "}
                in the environment secrets tab, then restart the server.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <label className="mb-1.5 block text-xs text-zinc-400">Password</label>
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter access password"
                disabled={submitting}
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-zinc-500 disabled:opacity-50"
                autoComplete="current-password"
              />
              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={submitting || !password.trim()}
                className="mt-4 w-full rounded bg-white py-2.5 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 disabled:opacity-40"
              >
                {submitting ? "Checking..." : "Enter"}
              </button>
            </form>
          )}
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

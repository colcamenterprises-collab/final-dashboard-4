import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usePinAuth } from "@/components/PinLoginGate";

type ProfileUser = {
  id: number;
  name: string;
  role: string;
  active: boolean;
  avatarUrl: string | null;
  createdAt: string;
};

function AvatarCircle({ name, avatarUrl, size = 80 }: { name: string; avatarUrl: string | null; size?: number }) {
  const initial = name.slice(0, 1).toUpperCase();
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border-2 border-gray-200"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size / 2.5 }}
      className="rounded-full bg-emerald-900/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0"
    >
      {initial}
    </div>
  );
}

export default function UserProfile() {
  const { currentUser } = usePinAuth();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [pinForm, setPinForm] = useState({ currentPin: "", newPin: "", confirmPin: "" });
  const [pinError, setPinError] = useState("");
  const [pinSuccess, setPinSuccess] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [avatarSuccess, setAvatarSuccess] = useState("");

  const { data, isLoading } = useQuery<{ user: ProfileUser }>({
    queryKey: ["/api/pin-auth/me/profile"],
    queryFn: async () => {
      const r = await fetch("/api/pin-auth/me/profile", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load profile");
      return r.json();
    },
  });

  const avatarMutation = useMutation({
    mutationFn: async (avatarUrl: string | null) => {
      const r = await fetch("/api/pin-auth/me/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/pin/me/profile"] });
      setAvatarSuccess("Avatar updated.");
      setAvatarError("");
      setTimeout(() => setAvatarSuccess(""), 3000);
    },
    onError: (e: any) => {
      setAvatarError(e.message);
      setAvatarSuccess("");
    },
  });

  const pinMutation = useMutation({
    mutationFn: async (body: { currentPin: string; newPin: string }) => {
      const r = await fetch("/api/pin-auth/me/pin", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Failed");
      return r.json();
    },
    onSuccess: () => {
      setPinSuccess("PIN changed successfully.");
      setPinError("");
      setPinForm({ currentPin: "", newPin: "", confirmPin: "" });
      setTimeout(() => setPinSuccess(""), 4000);
    },
    onError: (e: any) => {
      setPinError(e.message);
      setPinSuccess("");
    },
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setAvatarError("Image must be under 2MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      avatarMutation.mutate(base64);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");
    if (pinForm.newPin.length < 4 || pinForm.newPin.length > 8) {
      setPinError("New PIN must be 4–8 digits.");
      return;
    }
    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinError("New PIN and confirmation do not match.");
      return;
    }
    pinMutation.mutate({ currentPin: pinForm.currentPin, newPin: pinForm.newPin });
  }

  const user = data?.user;
  const displayName = user?.name ?? currentUser?.name ?? "—";
  const displayRole = user?.role ?? currentUser?.role ?? "—";
  const joinedDate = user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-GB") : "—";

  return (
    <div className="max-w-xl mx-auto space-y-6" style={{ fontFamily: "'Poppins', sans-serif", fontSize: "12px" }}>
      <div>
        <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
        <p className="text-xs text-gray-400 mt-0.5">View your details and manage your account settings</p>
      </div>

      {isLoading && <div className="rounded border border-gray-200 bg-white px-4 py-6 text-center text-xs text-gray-400">Loading profile…</div>}

      {!isLoading && (
        <>
          {/* Avatar + Identity */}
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-xs font-semibold text-gray-500 mb-4">Profile Photo</p>
            <div className="flex items-center gap-5">
              <AvatarCircle name={displayName} avatarUrl={user?.avatarUrl ?? null} size={72} />
              <div className="space-y-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={avatarMutation.isPending}
                  className="rounded border border-gray-300 bg-white px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  {avatarMutation.isPending ? "Uploading…" : "Upload Photo"}
                </button>
                {user?.avatarUrl && (
                  <button
                    onClick={() => avatarMutation.mutate(null)}
                    disabled={avatarMutation.isPending}
                    className="block text-xs text-red-500 hover:text-red-700 transition-colors"
                  >
                    Remove photo
                  </button>
                )}
                <p className="text-xs text-gray-400">JPG or PNG, max 2MB</p>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
              </div>
            </div>
            {avatarError && <p className="mt-2 text-xs text-red-500">{avatarError}</p>}
            {avatarSuccess && <p className="mt-2 text-xs text-emerald-600">{avatarSuccess}</p>}
          </div>

          {/* Account Details */}
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-xs font-semibold text-gray-500 mb-4">Account Details</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400">Name</p>
                <p className="text-sm font-bold text-gray-900">{displayName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Role</p>
                <p className="text-sm font-bold text-gray-900 capitalize">{displayRole}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Status</p>
                <p className="text-sm font-bold text-gray-900">{user?.active ? "Active" : "Inactive"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400">Member Since</p>
                <p className="text-sm font-bold text-gray-900">{joinedDate}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">To change your name or role, ask an owner or manager.</p>
          </div>

          {/* Change PIN */}
          <div className="rounded border border-gray-200 bg-white p-5">
            <p className="text-xs font-semibold text-gray-500 mb-4">Change PIN</p>
            <form onSubmit={handlePinSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Current PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinForm.currentPin}
                  onChange={(e) => setPinForm((p) => ({ ...p, currentPin: e.target.value.replace(/\D/g, "") }))}
                  placeholder="••••"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinForm.newPin}
                  onChange={(e) => setPinForm((p) => ({ ...p, newPin: e.target.value.replace(/\D/g, "") }))}
                  placeholder="4–8 digits"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Confirm New PIN</label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={8}
                  value={pinForm.confirmPin}
                  onChange={(e) => setPinForm((p) => ({ ...p, confirmPin: e.target.value.replace(/\D/g, "") }))}
                  placeholder="••••"
                  className="w-full rounded border border-gray-200 px-3 py-2 text-xs text-gray-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
              {pinError && <p className="text-xs text-red-500">{pinError}</p>}
              {pinSuccess && <p className="text-xs text-emerald-600">{pinSuccess}</p>}
              <button
                type="submit"
                disabled={pinMutation.isPending || !pinForm.currentPin || !pinForm.newPin || !pinForm.confirmPin}
                className="rounded bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-40"
              >
                {pinMutation.isPending ? "Saving…" : "Change PIN"}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

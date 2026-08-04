import { useRef, useState } from "react";
import { Camera, Loader2, Trash2, UserRound } from "lucide-react";

type Props = {
  name: string;
  avatarUrl?: string | null;
  onChange: (avatarUrl: string | null) => Promise<void> | void;
  disabled?: boolean;
  compact?: boolean;
};

export default function StaffAvatarUpload({ name, avatarUrl, onChange, disabled = false, compact = false }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const chooseFile = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("image", file);
      const response = await fetch("/api/upload/staff-avatar", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.imageUrl) throw new Error(data.error || "Photo upload failed");

      const previous = avatarUrl;
      await onChange(data.imageUrl);

      if (previous?.startsWith("/uploads/staff-avatars/")) {
        void fetch("/api/upload/staff-avatar", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: previous }),
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Photo upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const remove = async () => {
    if (!avatarUrl) return;
    setBusy(true);
    setError("");
    try {
      const previous = avatarUrl;
      await onChange(null);
      if (previous.startsWith("/uploads/staff-avatars/")) {
        await fetch("/api/upload/staff-avatar", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl: previous }),
        });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove photo");
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border bg-slate-100">
          {avatarUrl ? (
            <img src={avatarUrl} alt={`${name} profile`} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-400"><UserRound className="h-5 w-5" /></div>
          )}
        </div>
        <span className="font-bold">{name}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border bg-slate-50 p-4">
      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-white bg-white shadow-sm">
        {avatarUrl ? (
          <img src={avatarUrl} alt={`${name} profile`} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300"><UserRound className="h-10 w-10" /></div>
        )}
      </div>
      <div className="min-w-[220px] flex-1">
        <div className="font-black">User photo</div>
        <div className="mt-1 text-xs text-slate-500">Upload JPG, PNG, WebP, HEIC or TIFF. Photos are automatically cropped to a square profile image.</div>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.heic,.heif,.tif,.tiff"
            className="hidden"
            disabled={disabled || busy}
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {avatarUrl ? "Replace photo" : "Upload photo"}
          </button>
          {avatarUrl && (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => void remove()}
              className="flex items-center gap-2 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </button>
          )}
        </div>
        {error && <div className="mt-2 text-xs font-semibold text-red-600">{error}</div>}
      </div>
    </div>
  );
}

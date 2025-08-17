import { Bell, Download } from "lucide-react";

export default function Topbar() {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-[1400px] px-6 h-14 flex items-center gap-4">
        {/* Logo (left) */}
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white grid place-items-center font-bold">S</div>
          {/* Keep logo only per request; no title here */}
        </div>

        {/* Greeting row — aligns horizontally with logo */}
        <div className="flex-1 flex items-center">
          <div className="text-xl font-extrabold">Hi Cam</div>
        </div>

        {/* Right actions (optional) */}
        <button className="hidden md:inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm">
          <Download className="h-4 w-4" />
          Download report
        </button>
        <button className="rounded-xl border p-2">
          <Bell className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}
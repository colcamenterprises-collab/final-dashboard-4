import { useLocation } from "wouter";
import { useState } from "react";

type Item = { label: string; path: string; color: string };

const SALES_OPS: Item[] = [
  { label: "Dashboard",         path: "/dashboard",    color: "bg-emerald-500" },
  { label: "Daily Sales Form",  path: "/daily-sales",   color: "bg-orange-500" },
  { label: "Daily Stock Form",  path: "/daily-stock",   color: "bg-violet-500" },
  { label: "Receipts",          path: "/receipts",      color: "bg-blue-500" },
  { label: "Expenses (Business)", path: "/expenses",    color: "bg-red-500" },
  { label: "System Status",     path: "/system-status", color: "bg-green-500" },
];

export default function Sidebar() {
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(true);

  // 256px (open) → 78px (collapsed)
  const width = open ? "w-64" : "w-[78px]";
  const show = open ? "" : "opacity-0 pointer-events-none";
  const gap  = open ? "gap-3" : "gap-0";

  return (
    <aside
      className={`shrink-0 ${width} transition-[width] duration-300 ease-in-out
                  bg-white border-r border-gray-200 flex flex-col sticky top-0 h-screen`}
      style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.03)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className={`font-semibold tracking-tight text-gray-900 ${open ? "" : "sr-only"}`}>
          Smash Brothers
        </div>
        <button
          aria-label="Toggle sidebar"
          onClick={() => setOpen(v => !v)}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
        >
          {open ? "‹" : "›"}
        </button>
      </div>

      {/* Section */}
      <div className={`text-[11px] font-semibold uppercase tracking-wide text-gray-400 px-3 ${open ? "mb-2" : "sr-only"}`}>
        Sales & Operations
      </div>

      <nav className="px-3 pb-6 overflow-y-auto">
        <ul className="space-y-2">
          {SALES_OPS.map(it => {
            const active = location.startsWith(it.path) || (it.path === "/dashboard" && location === "/");
            return (
              <li key={it.path}>
                <button
                  onClick={() => navigate(it.path)}
                  className={`w-full flex items-center ${gap} rounded-xl px-2 py-2
                              hover:bg-gray-50 border border-transparent
                              ${active ? "bg-emerald-50 border-emerald-200" : ""}`}
                >
                  <span className={`h-3 w-3 rounded ${it.color}`} />
                  <span className={`text-sm text-gray-800 transition-opacity ${show}`}>{it.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
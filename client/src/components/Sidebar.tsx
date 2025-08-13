import { useLocation } from "wouter";
import { useState } from "react";

type Item = { label: string; path: string; icon: JSX.Element };

const Icon = {
  dash: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 7h7v6H4zM13 7h7v10h-7zM4 15h7v2H4z" />
    </svg>
  ),
  sales: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M4 19h16M5 17l2-9h10l2 9M9 10v3M12 10v3M15 10v3" />
    </svg>
  ),
  stock: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 7v10l9 4 9-4V7" />
    </svg>
  ),
  receipts: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M8 3h10v18l-3-2-3 2-3-2-3 2V3z" /><path d="M10 7h6M10 11h6M10 15h6" />
    </svg>
  ),
  expenses: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="8" /><path d="M9 9h3a3 3 0 110 6H9m3-6V7m0 10v-2" />
    </svg>
  ),
  status: (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5 5l2.1 2.1M16.9 16.9L19 19M5 19l2.1-2.1M16.9 7.1L19 5" />
    </svg>
  ),
};

const NAV: Item[] = [
  { label: "Dashboard",            path: "/dashboard",     icon: Icon.dash },
  { label: "Daily Sales Form",     path: "/daily-sales",   icon: Icon.sales },
  { label: "Daily Stock Form",     path: "/daily-stock",   icon: Icon.stock },
  { label: "Receipts",             path: "/receipts",      icon: Icon.receipts },
  { label: "Expenses (Business)",  path: "/expenses",      icon: Icon.expenses },
  { label: "System Status",        path: "/system-status", icon: Icon.status },
];

export default function Sidebar() {
  const [location, navigate] = useLocation();
  const [open, setOpen] = useState(true);

  const width = open ? "w-64" : "w-[78px]";
  const label = open ? "" : "opacity-0 pointer-events-none";
  const iconOnly = open ? "" : "mx-auto";
  const padX = open ? "px-3" : "px-2";

  return (
    <aside
      className={`sticky top-0 h-screen shrink-0 ${width}
                  transition-[width] duration-300 ease-in-out
                  bg-white border-r border-gray-200 flex flex-col`}
      style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.03)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className={`font-semibold tracking-tight text-gray-900 ${open ? "" : "sr-only"}`}>Smash Brothers</div>
        <button
          aria-label="Toggle sidebar"
          onClick={() => setOpen(v => !v)}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
        >
          {open ? "‹" : "›"}
        </button>
      </div>

      {/* Section divider */}
      <div className={`text-[11px] font-semibold uppercase tracking-wide text-gray-400 px-4 ${open ? "mb-2" : "sr-only"}`}>
        Sales & Operations
      </div>

      {/* Nav (no dots; green active pill) */}
      <nav className="px-2 pb-6 overflow-y-auto">
        <ul className="space-y-2">
          {NAV.map(item => {
            const active = location.startsWith(item.path);
            return (
              <li key={item.path}>
                <button
                  onClick={() => navigate(item.path)}
                  title={!open ? item.label : undefined}
                  className={`relative w-full flex items-center ${padX} py-2 rounded-full
                              border border-transparent hover:bg-gray-50
                              ${active ? "bg-emerald-600 text-white shadow-sm" : "text-gray-800"}`}
                >
                  <span className={`text-current ${iconOnly}`}>{item.icon}</span>
                  <span className={`ml-3 text-sm transition-opacity ${label}`}>{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
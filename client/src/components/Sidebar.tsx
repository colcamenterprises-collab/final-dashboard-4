// client/src/components/Sidebar.tsx
import { useLocation, Link } from 'wouter';
import { useState } from 'react';

const NAV = [
  {
    group: "Sales & Operations",
    items: [
      { label: "Dashboard", path: "/", color: "bg-emerald-500" },
      { label: "Daily Sales Form", path: "/daily-sales", color: "bg-orange-500" },
      { label: "Daily Stock Form", path: "/daily-stock-sales", color: "bg-violet-500" },
      { label: "Receipts", path: "/receipts", color: "bg-blue-500" },
      { label: "Expenses (Business)", path: "/expenses", color: "bg-red-500" },
      { label: "System Status", path: "/system-status", color: "bg-green-500" },
    ],
  },
];

export default function Sidebar() {
  const [open, setOpen] = useState(true);
  const [location] = useLocation();

  const width = open ? "w-64" : "w-[78px]";
  const labelVis = open ? "opacity-100" : "opacity-0 pointer-events-none";
  const gap = open ? "gap-3" : "gap-0";

  return (
    <aside
      className={`shrink-0 ${width} transition-[width] duration-300 ease-in-out
                  bg-white border-r border-gray-200 flex flex-col`}
      style={{ boxShadow: "2px 0 12px rgba(0,0,0,0.03)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4">
        <div className={`font-semibold tracking-tight text-gray-900 ${open ? "" : "sr-only"}`}>
          Smash Brothers
        </div>
        <button
          aria-label="Toggle sidebar"
          onClick={() => setOpen(o => !o)}
          className="rounded-lg border border-gray-200 px-2 py-1 text-xs hover:bg-gray-50"
        >
          {open ? "‹" : "›"}
        </button>
      </div>

      {/* Nav */}
      <nav className="px-3 pb-6 overflow-y-auto">
        {NAV.map(section => (
          <div key={section.group} className="mb-5">
            <div className={`text-[11px] font-semibold uppercase tracking-wide text-gray-400 px-2 mb-2 ${open ? "" : "sr-only"}`}>
              {section.group}
            </div>
            <ul className="space-y-2">
              {section.items.map(item => {
                const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`flex items-center ${gap} rounded-xl px-2 py-2
                                  hover:bg-gray-50 border border-transparent
                                  ${active ? "bg-emerald-50 border-emerald-200" : ""}`}
                    >
                      <span className={`h-3 w-3 rounded ${item.color}`} />
                      <span className={`text-sm text-gray-800 transition-opacity ${labelVis}`}>
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}
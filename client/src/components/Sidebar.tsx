import { NavLink } from "react-router-dom";
import { useState, useEffect } from "react";

type Group = {
  title: string;
  items: { to: string; icon?: JSX.Element; label: string }[];
};

/**
 * PHASE L — Navigation & Ownership Reset (Legacy Sidebar)
 * 
 * CANONICAL OWNERSHIP:
 * - PURCHASING = items & stock (Purchasing List, Purchasing Log, Manual Stock Purchase)
 * - FINANCE = money only (Expenses, Profit & Loss)
 * - ANALYSIS = insight (Ingredient Reconciliation, Sales & Shift Analysis)
 * - MENU MANAGEMENT = sellables (Recipe Management, Menu Manager)
 */

const groups: Group[] = [
  {
    title: "Daily Sales",
    items: [
      { to: "/operations/daily-sales", label: "Daily Sales Form" },
      { to: "/operations/daily-sales-library", label: "Library" },
    ],
  },
  {
    title: "Operations",
    items: [
      { to: "/operations/health-safety-audit", label: "Health & Safety Audit" },
    ],
  },
  {
    title: "Purchasing",
    items: [
      { to: "/operations/purchasing", label: "Purchasing List" },
      { to: "/operations/purchasing-shift-log", label: "Purchasing Log" },
      { to: "/operations/manual-stock-purchase", label: "Manual Stock Purchase" },
    ],
  },
  {
    title: "Finance", 
    items: [
      { to: "/finance/expenses", label: "Expenses" },
      { to: "/finance/profit-loss", label: "Profit & Loss" },
    ],
  },
  {
    title: "Menu Management",
    items: [
      { to: "/recipe-management", label: "Recipe Management" },
      { to: "/menu/manager", label: "Menu Manager" },
    ],
  },
  {
    title: "Analysis",
    items: [
      { to: "/analysis/ingredient-reconciliation", label: "Ingredient Reconciliation" },
      { to: "/analysis/daily-review", label: "Sales & Shift Analysis" },
    ],
  },
  {
    title: "Membership",
    items: [
      { to: "/membership/dashboard", label: "Member Dashboard" },
      { to: "/membership/register", label: "Registration Form" },
    ],
  },
  {
    title: "Customer Ordering",
    items: [
      { to: "/order", label: "Online Ordering" },
    ],
  },
];

function useLockBody(lock: boolean) {
  useEffect(() => {
    if (!lock) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [lock]);
}

export default function Sidebar({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate?: () => void;
}) {
  // lock scroll when mobile drawer open
  useLockBody(open);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // collapsible groups (desktop + mobile)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (t: string) =>
    setExpanded((p) => ({ ...p, [t]: p[t] ? false : true }));

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <aside
      className="h-full w-64 shrink-0 bg-white border-r border-gray-200 flex flex-col"
      aria-label="Main menu"
    >
      {children}
    </aside>
  );

  // Desktop (md+): always visible
  // Mobile (<md): overlay drawer
  return (
    <>
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/35 backdrop-blur-[1px] transition-opacity md:hidden ${
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden={open ? "false" : "true"}
      />

      {/* Mobile drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform md:hidden ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        role="dialog"
        aria-modal="true"
      >
        <Wrapper>
          <Header onClose={onClose} />
          <NavSections
            expanded={expanded}
            toggle={toggle}
            onNavigate={() => {
              onNavigate?.();
              onClose();
            }}
          />
        </Wrapper>
      </div>

      {/* Desktop static sidebar */}
      <div className="hidden md:flex">
        <Wrapper>
          <Header />
          <NavSections
            expanded={expanded}
            toggle={toggle}
            onNavigate={onNavigate}
          />
        </Wrapper>
      </div>
    </>
  );
}

function Header({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-md bg-emerald-600 text-white grid place-items-center font-bold">
          S
        </div>
        <div>
          <div className="font-semibold text-gray-900">Smash Brothers</div>
          <div className="text-xs text-gray-500">Restaurant Hub</div>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="p-2 rounded-md hover:bg-gray-100 active:bg-gray-200 md:hidden"
          aria-label="Close menu"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function NavSections({
  expanded,
  toggle,
  onNavigate,
}: {
  expanded: Record<string, boolean>;
  toggle: (t: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <nav className="px-3 pb-6 overflow-y-auto">
      {/* Home */}
      <div className="mb-1">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-semibold ${
              isActive ? "bg-emerald-50 text-emerald-700" : "text-gray-800 hover:bg-gray-50"
            }`
          }
          onClick={onNavigate}
        >
          <span>Home</span>
        </NavLink>
      </div>

      {groups.map((g) => {
        const isOpen = expanded[g.title] ?? true;
        return (
          <div key={g.title} className="mt-4">
            <button
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold tracking-wide uppercase text-gray-700"
              onClick={() => toggle(g.title)}
              aria-expanded={isOpen}
              aria-controls={`group-${g.title}`}
            >
              <span>{g.title}</span>
              <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>
                ▸
              </span>
            </button>
            <div id={`group-${g.title}`} hidden={!isOpen} className="mt-1 space-y-1">
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-md text-sm ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-gray-700 hover:bg-gray-50"
                    }`
                  }
                >
                  <span className="truncate">{it.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
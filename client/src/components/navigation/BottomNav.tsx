import { NavLink, useLocation } from "react-router-dom";
import { Home, BarChart3, ShoppingCart, Receipt, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    to: "/",
    icon: Home,
    label: "Home",
    testId: "nav-home"
  },
  {
    to: "/finance",
    icon: BarChart3,
    label: "Finance",
    testId: "nav-finance"
  },
  {
    to: "/operations/daily-sales",
    icon: Receipt,
    label: "Operations",
    testId: "nav-operations"
  },
  {
    to: "/operations/shopping-list",
    icon: ShoppingCart,
    label: "Shopping",
    testId: "nav-shopping"
  },
  {
    to: "/menu/recipes",
    icon: Settings,
    label: "Menu",
    testId: "nav-menu"
  }
];

export function BottomNav() {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 dark:bg-slate-900 dark:border-slate-800">
      <div className="flex items-center justify-around px-2 py-2 pb-[env(safe-area-inset-bottom,8px)]">
        {navItems.map(({ to, icon: Icon, label, testId }) => (
          <NavLink
            key={to}
            to={to}
            className={cn(
              "flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 min-w-0 flex-1",
              isActive(to)
                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
            )}
            data-testid={testId}
          >
            <Icon 
              className={cn(
                "h-5 w-5 transition-transform duration-200",
                isActive(to) && "scale-110"
              )} 
            />
            <span className="text-xs font-medium truncate w-full text-center">
              {label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
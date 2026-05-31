import { NavLink, useLocation, Link } from "react-router-dom";
import { usePinAuth } from "@/components/PinLoginGate";
import { cn } from "@/lib/utils";
import {
  Home,
  BarChart3,
  Receipt,
  ShoppingCart,
  ChevronDown,
  X,
  ShoppingBag,
  Package,
  UtensilsCrossed,
  Calculator,
  TrendingUp,
  DollarSign,
  FileText,
  List,
  ShieldCheck,
  ClipboardList,
  AlertTriangle,
  BookOpen,
  Wallet,
  Upload,
  Download,
  History,
  Users,
  CalendarDays,
  UserCheck,
  Settings,
  MapPin,
  Globe,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ModernButton } from "@/components/ui";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  ownerOnly?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

const navigationGroups: NavGroup[] = [
  {
    title: "Core",
    defaultOpen: true,
    items: [
      { to: "/dashboard",                         label: "Home",           icon: Home,          testId: "nav-home" },
      { to: "/operations/daily-sales",            label: "Daily Sales V2", icon: Receipt,       testId: "nav-daily-sales" },
      { to: "/operations/daily-stock",            label: "Daily Stock V2", icon: Package,       testId: "nav-daily-stock" },
      { to: "/operations/daily-sales-v2/library", label: "Form Library",   icon: BarChart3,     testId: "nav-library", ownerOnly: true },
      { to: "/operations/purchasing",             label: "Purchasing",     icon: ShoppingCart,  testId: "nav-purchasing" },
    ],
  },
  {
    title: "Menu",
    defaultOpen: false,
    items: [
      { to: "/menu/items",           label: "Menu Items",      icon: UtensilsCrossed, testId: "nav-menu-items" },
      { to: "/menu/ingredients",     label: "Ingredients",     icon: List,            testId: "nav-ingredients" },
      { to: "/menu/cost-calculator", label: "Cost Calculator", icon: Calculator,      testId: "nav-cost-calculator" },
      { to: "/menu/recipes",         label: "Recipes",         icon: BookOpen,        testId: "nav-recipes" },
    ],
  },
  {
    title: "Ordering",
    defaultOpen: false,
    items: [
      { to: "/ordering/orders",    label: "Orders",          icon: ShoppingBag, testId: "nav-orders" },
      { to: "/ordering/catalog",   label: "Catalog",         icon: BookOpen,    testId: "nav-catalog" },
      { to: "/online-ordering",    label: "Online Ordering", icon: Globe,       testId: "nav-online-ordering" },
    ],
  },
  {
    title: "Finance",
    defaultOpen: false,
    items: [
      { to: "/finance",                  label: "Finance Hub",    icon: Wallet,     testId: "nav-finance-hub" },
      { to: "/finance/profit-loss",     label: "Profit & Loss",  icon: TrendingUp, testId: "nav-profit-loss" },
      { to: "/finance/expenses",        label: "Expenses",       icon: DollarSign, testId: "nav-expenses" },
      { to: "/finance/expenses-import", label: "Import",         icon: Upload,     testId: "nav-expenses-import" },
    ],
  },
  {
    title: "Reports",
    defaultOpen: false,
    items: [
      { to: "/reports/shift-reports",  label: "Shift Reports",  icon: FileText, testId: "nav-shift-reports" },
      { to: "/reports/shift-history",  label: "Shift History",  icon: History,  testId: "nav-shift-history" },
      { to: "/reports/export",         label: "Export",         icon: Download, testId: "nav-export" },
    ],
  },
  {
    title: "Operations",
    defaultOpen: false,
    items: [
      { to: "/operations/shopping-list",      label: "Shopping List",    icon: ShoppingCart,  testId: "nav-shopping-list" },
      { to: "/operations/health-safety",      label: "Health & Safety",  icon: ShieldCheck,   testId: "nav-health-safety" },
      { to: "/operations/manager-checklist",  label: "Manager Checklist",icon: ClipboardList, testId: "nav-manager-checklist" },
      { to: "/operations/issue-register",     label: "Issue Register",   icon: AlertTriangle, testId: "nav-issue-register" },
    ],
  },
  {
    title: "Staff",
    defaultOpen: false,
    items: [
      { to: "/staff/dashboard",  label: "Overview",    icon: Users,       testId: "nav-staff-dashboard" },
      { to: "/staff/members",    label: "Members",     icon: UserCheck,   testId: "nav-staff-members" },
      { to: "/staff/roster",     label: "Roster",      icon: CalendarDays,testId: "nav-staff-roster" },
      { to: "/staff/cleaning",   label: "Cleaning",    icon: ClipboardList,testId: "nav-staff-cleaning" },
      { to: "/staff/attendance", label: "Attendance",  icon: Receipt,     testId: "nav-staff-attendance" },
      { to: "/staff/settings",   label: "Settings",    icon: Settings,    testId: "nav-staff-settings" },
    ],
  },
];

interface ModernSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onCollapseToggle?: () => void;
  className?: string;
}

export function ModernSidebar({ isOpen, onClose, isCollapsed = false, onCollapseToggle, className }: ModernSidebarProps) {
  const location = useLocation();
  const { currentUser, logout } = usePinAuth();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(navigationGroups.filter(g => g.defaultOpen).map(g => g.title))
  );

  useEffect(() => {
    const path = location.pathname;
    for (const group of navigationGroups) {
      const hasActiveItem = group.items.some(
        (item) => path === item.to || path.startsWith(item.to + "/")
      );
      if (hasActiveItem) {
        setOpenGroups(prev => {
          if (prev.has(group.title)) return prev;
          const next = new Set(prev);
          next.add(group.title);
          return next;
        });
        break;
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const toggleGroup = (title: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const isActive = (path: string) =>
    path === "/dashboard"
      ? location.pathname === "/dashboard"
      : location.pathname.startsWith(path);

  const visibleGroups = navigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => !item.ownerOnly || currentUser?.role === "owner"),
  })).filter(group => group.items.length > 0);

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          data-testid="sidebar-backdrop"
        />
      )}

      <div
        ref={sidebarRef}
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-white border-r border-slate-200 transform transition-transform duration-300 dark:bg-slate-900 dark:border-slate-800",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          isCollapsed ? "w-[72px] lg:w-[72px]" : "w-80 lg:w-64",
          "lg:fixed lg:z-auto",
          className
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center border-b border-slate-200 dark:border-slate-800",
          isCollapsed ? "justify-center p-3" : "justify-between p-4"
        )}>
          <img
            src="/attached_assets/Yellow Circle - Black Logo_1757766401641.png"
            alt="Logo"
            className={cn("object-contain", isCollapsed ? "w-8 h-8" : "w-10 h-10")}
          />
          {!isCollapsed && (
            <div className="flex items-center gap-1">
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={onCollapseToggle}
                className="hidden lg:inline-flex"
                aria-label="Collapse sidebar"
              >
                {"<"}
              </ModernButton>
              <ModernButton
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="lg:hidden"
                data-testid="button-close-sidebar"
              >
                <X className="h-4 w-4" />
              </ModernButton>
            </div>
          )}
          {isCollapsed && (
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onCollapseToggle}
              className="hidden lg:inline-flex mt-1"
              aria-label="Expand sidebar"
            >
              {">"}
            </ModernButton>
          )}
        </div>

        {/* Navigation */}
        <nav
          className="overflow-y-auto p-3 space-y-1"
          style={{ maxHeight: "calc(100vh - 140px)" }}
        >
          {visibleGroups.map((group) => {
            const isGroupOpen = openGroups.has(group.title);

            return (
              <div key={group.title} className="space-y-0.5">
                {!isCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-semibold text-slate-400 hover:text-slate-600 uppercase tracking-wider rounded-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    aria-expanded={isGroupOpen}
                    data-testid={`group-toggle-${group.title.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <span>{group.title}</span>
                    <ChevronDown
                      className={cn(
                        "h-3 w-3 transition-transform duration-200",
                        isGroupOpen ? "rotate-180" : "rotate-0"
                      )}
                    />
                  </button>
                )}

                {(isGroupOpen || isCollapsed) && (
                  <div className={cn("space-y-0.5", !isCollapsed && "ml-1")}>
                    {group.items.map((item) => {
                      const active = isActive(item.to);
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg transition-all duration-150",
                            isCollapsed && "lg:justify-center lg:px-2",
                            active
                              ? "bg-black text-white dark:bg-white dark:text-black"
                              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"
                          )}
                          data-testid={item.testId}
                        >
                          <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-white dark:text-black" : "text-slate-400")} />
                          {!isCollapsed && <span className="truncate">{item.label}</span>}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 border-t border-slate-200 dark:border-slate-800",
          isCollapsed ? "p-2" : "px-4 py-3"
        )}>
          {!isCollapsed && (
            <p className="text-[10px] text-slate-400 dark:text-slate-600">Smash Brothers Dashboard</p>
          )}
        </div>
      </div>
    </>
  );
}

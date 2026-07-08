import { NavLink, useLocation } from "react-router-dom";
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
  UtensilsCrossed,
  TrendingUp,
  DollarSign,
  FileText,
  List,
  ShieldCheck,
  AlertTriangle,
  ClipboardList,
  BookOpen,
  Wallet,
  Users,
  CalendarDays,
  UserCheck,
  Settings,
  QrCode,
  Monitor,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

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

const homeNavItem: NavItem = {
  to: "/dashboard",
  label: "Home",
  icon: Home,
  testId: "nav-home",
};

const navigationGroups: NavGroup[] = [
  {
    title: "Operations",
    defaultOpen: true,
    items: [
      { to: "/operations/daily-sales",             label: "Daily Sales & Stock Form", icon: Receipt,       testId: "nav-daily-sales" },
      { to: "/operations/daily-sales-v2/library",  label: "Daily Form Library",       icon: BarChart3,     testId: "nav-library", ownerOnly: true },
      { to: "/operations/purchasing",              label: "Purchasing",               icon: ShoppingCart,  testId: "nav-purchasing" },
      { to: "/operations/shopping-list",           label: "Shopping List",            icon: ShoppingCart,  testId: "nav-shopping-list" },
      { to: "/operations/health-safety",           label: "Health & Safety",          icon: ShieldCheck,   testId: "nav-health-safety" },
    ],
  },
  {
    title: "Reporting",
    defaultOpen: false,
    items: [
      { to: "/reports/receipts-analysis", label: "Receipt Analytics",             icon: BarChart3, testId: "nav-receipt-analytics" },
      { to: "/reports/shift-reports",     label: "Shift Verification & History", icon: FileText,      testId: "nav-shift-reports" },
      { to: "/reports/inventory-reconciliation", label: "Inventory Reconciliation", icon: ClipboardList, testId: "nav-inventory-reconciliation" },
    ],
  },
  {
    title: "Menu",
    defaultOpen: false,
    items: [
      { to: "/menu/items",       label: "Menu Items",          icon: UtensilsCrossed, testId: "nav-menu-items" },
      { to: "/menu/recipes",     label: "Recipes & Costing",   icon: BookOpen,        testId: "nav-recipes" },
      { to: "/menu/modifiers",   label: "Modifiers",           icon: List,            testId: "nav-modifiers" },
      { to: "/menu/categories",  label: "Categories",          icon: List,            testId: "nav-menu-categories" },
    ],
  },
  {
    title: "Sales & Ordering",
    defaultOpen: false,
    items: [
      { to: "/admin/ordering/orders",    label: "Orders",             icon: ShoppingBag,     testId: "nav-ordering-orders" },
      { to: "/admin/ordering/qr-codes",  label: "QR Codes & Settings", icon: QrCode,          testId: "nav-ordering-qr" },
      { to: "/kitchen/display",          label: "Kitchen Display",    icon: Monitor,         testId: "nav-kitchen-display" },
    ],
  },
  {
    title: "Finance",
    defaultOpen: false,
    items: [
      { to: "/finance",             label: "Finance Hub",     icon: Wallet,     testId: "nav-finance-hub" },
      { to: "/finance/profit-loss", label: "Profit and Loss", icon: TrendingUp, testId: "nav-profit-loss" },
      { to: "/finance/expenses",    label: "Expenses",        icon: DollarSign, testId: "nav-expenses" },
      { to: "/finance/expenses-import", label: "Bank Statement Import", icon: DollarSign, testId: "nav-bank-statement-import" },
    ],
  },
  {
    title: "Human Resources",
    defaultOpen: false,
    items: [
      { to: "/staff/dashboard",  label: "Overview",     icon: Users,        testId: "nav-staff-dashboard" },
      { to: "/staff/members",    label: "Staff List",   icon: UserCheck,    testId: "nav-staff-members" },
      { to: "/staff/roster",     label: "Staff Roster", icon: CalendarDays, testId: "nav-staff-roster" },
      { to: "/staff/attendance", label: "Attendance",   icon: Receipt,      testId: "nav-staff-attendance" },
      { to: "/staff/settings",   label: "HR Settings",  icon: Settings,     testId: "nav-staff-settings" },
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
  const { currentUser } = usePinAuth();
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

  const closeOnMobile = () => {
    if (window.matchMedia("(max-width: 1023px)").matches) {
      onClose();
    }
  };

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
          className="fixed inset-0 z-40 bg-black/80 lg:hidden"
          onClick={onClose}
          data-testid="sidebar-backdrop"
        />
      )}

      <div
        ref={sidebarRef}
        className={cn(
          "fixed top-0 left-0 z-50 h-full bg-[#111111] border-r border-neutral-800/60 transform transition-transform duration-300",
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          "w-80",
          isCollapsed ? "lg:w-[72px]" : "lg:w-64",
          "lg:fixed lg:z-auto",
          className
        )}
      >
        {/* Header — logo + collapse toggle */}
        <div className={cn(
          "flex items-center border-b border-neutral-800/60",
          isCollapsed ? "justify-between p-4 lg:justify-center lg:p-3 lg:flex-col lg:gap-2" : "justify-between p-4"
        )}>
          <img
            src="/attached_assets/Yellow Circle - Black Logo_1757766401641.png"
            alt="SBB Logo"
            className={cn("object-contain rounded-lg", isCollapsed ? "w-9 h-9 lg:w-8 lg:h-8" : "w-9 h-9")}
          />
          {(!isCollapsed || isOpen) && (
            <div className="flex items-center gap-1">
              <button
                onClick={onCollapseToggle}
                className="hidden lg:flex items-center justify-center h-7 w-7 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors text-xs"
                aria-label="Collapse sidebar"
              >
                ‹
              </button>
              <button
                onClick={onClose}
                className="lg:hidden flex items-center justify-center h-7 w-7 rounded-md text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                data-testid="button-close-sidebar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
          {isCollapsed && (
            <button
              onClick={onCollapseToggle}
              className="hidden lg:flex items-center justify-center h-6 w-6 rounded-md text-neutral-600 hover:text-neutral-300 hover:bg-neutral-800 transition-colors text-xs"
              aria-label="Expand sidebar"
            >
              ›
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav
          className="overflow-y-auto p-2 space-y-0.5"
          style={{ maxHeight: "calc(100vh - 120px)" }}
        >
          {(() => {
            const active = isActive(homeNavItem.to);
            const HomeIcon = homeNavItem.icon;
            return (
              <NavLink
                to={homeNavItem.to}
                onClick={closeOnMobile}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-150",
                  isCollapsed && "lg:justify-center lg:px-2",
                  active
                    ? "bg-[#FFD400] text-[#111111]"
                    : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
                )}
                data-testid={homeNavItem.testId}
              >
                <HomeIcon className={cn(
                  "h-4 w-4 flex-shrink-0",
                  active ? "text-[#111111]" : "text-neutral-500 group-hover:text-neutral-300"
                )} />
                <span className={cn("truncate", isCollapsed && "lg:hidden")}>{homeNavItem.label}</span>
              </NavLink>
            );
          })()}

          {visibleGroups.map((group) => {
            const isGroupOpen = openGroups.has(group.title);

            return (
              <div key={group.title} className="space-y-0.5">
                <button
                  onClick={() => toggleGroup(group.title)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-[13px] font-bold text-white hover:text-neutral-100 uppercase tracking-wider rounded-md hover:bg-neutral-800/50 transition-colors",
                    isCollapsed && "lg:hidden"
                  )}
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

                <div
                  className={cn(
                    "space-y-0.5",
                    !isCollapsed && "ml-0.5",
                    !isGroupOpen && (isCollapsed ? "hidden lg:block" : "hidden")
                  )}
                >
                  {group.items.map((item) => {
                    const active = isActive(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={closeOnMobile}
                        className={cn(
                          "flex items-center gap-2.5 px-2.5 py-2 text-xs font-medium rounded-lg transition-all duration-150",
                          isCollapsed && "lg:justify-center lg:px-2",
                          active
                            ? "bg-[#FFD400] text-[#111111]"
                            : "text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800"
                        )}
                        data-testid={item.testId}
                      >
                        <item.icon className={cn(
                          "h-4 w-4 flex-shrink-0",
                          active ? "text-[#111111]" : "text-neutral-500 group-hover:text-neutral-300"
                        )} />
                        <span className={cn("truncate", isCollapsed && "lg:hidden")}>{item.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 border-t border-neutral-800/60",
          isCollapsed ? "p-2" : "px-4 py-3"
        )}>
          <p className={cn("text-[10px] text-neutral-700", isCollapsed && "lg:hidden")}>Smash Brothers Dashboard</p>
        </div>
      </div>
    </>
  );
}

import { NavLink, useLocation } from "react-router-dom";
import { usePinAuth } from "@/components/PinLoginGate";
import { cn } from "@/lib/utils";
import { Home, BarChart3, Receipt, ShoppingCart, ChevronDown, X, ShoppingBag, UtensilsCrossed, TrendingUp, DollarSign, FileText, List, ShieldCheck, ClipboardList, BookOpen, Wallet, Settings, Monitor, CookingPot, Crown } from "lucide-react";
import { useState, useEffect, useRef } from "react";

type NavItem = { to: string; label: string; icon: React.ComponentType<{ className?: string }>; testId: string; ownerOnly?: boolean; subItem?: boolean; };
type NavGroup = { title: string; items: NavItem[]; defaultOpen?: boolean; };

const homeNavItem: NavItem = { to: "/dashboard", label: "Home", icon: Home, testId: "nav-home" };
const navigationGroups: NavGroup[] = [
  { title: "Operations", defaultOpen: true, items: [
    { to: "/operations/daily-sales", label: "Daily Sales & Stock Form", icon: Receipt, testId: "nav-daily-sales" },
    { to: "/operations/daily-forms/resume", label: "Resume Forms", icon: ClipboardList, testId: "nav-resume-forms", subItem: true },
    { to: "/operations/daily-sales-v2/library", label: "Daily Form Library", icon: BarChart3, testId: "nav-library", ownerOnly: true, subItem: true },
    { to: "/operations/purchasing", label: "Purchasing", icon: ShoppingCart, testId: "nav-purchasing" },
    { to: "/operations/shopping-list", label: "Shopping List", icon: ShoppingCart, testId: "nav-shopping-list" },
    { to: "/operations/health-safety", label: "Health & Safety", icon: ShieldCheck, testId: "nav-health-safety" },
  ]},
  { title: "Reporting", items: [
    { to: "/reports/sales-summary", label: "Sales Summary", icon: TrendingUp, testId: "nav-sales-summary", ownerOnly: true },
    { to: "/reports/shift-summary", label: "Shift Summary", icon: FileText, testId: "nav-shift-summary", ownerOnly: true },
    { to: "/reports/payment-types", label: "Sales by Payment Type", icon: Wallet, testId: "nav-payment-types", ownerOnly: true },
    { to: "/reports/receipts", label: "Receipts", icon: Receipt, testId: "nav-receipts", ownerOnly: true },
    { to: "/reports/sales-by-item", label: "Sales by Item", icon: BarChart3, testId: "nav-sales-by-item", ownerOnly: true },
    { to: "/reports/shift-report", label: "Shift Report", icon: ClipboardList, testId: "nav-shift-report" },
  ]},
  { title: "Finance", items: [
    { to: "/finance", label: "Finance Hub", icon: Wallet, testId: "nav-finance-hub" },
    { to: "/finance/profit-loss", label: "Profit and Loss", icon: TrendingUp, testId: "nav-profit-loss" },
    { to: "/finance/expenses", label: "Expenses", icon: DollarSign, testId: "nav-expenses" },
  ]},
  { title: "Menu", items: [
    { to: "/menu/items", label: "Menu Items", icon: UtensilsCrossed, testId: "nav-menu-items" },
    { to: "/menu/recipes", label: "Recipes & Costing", icon: BookOpen, testId: "nav-recipes" },
    { to: "/menu/modifiers", label: "Modifiers", icon: List, testId: "nav-modifiers" },
    { to: "/menu/categories", label: "Categories", icon: List, testId: "nav-menu-categories" },
  ]},
  { title: "POS", defaultOpen: true, items: [
    { to: "/pos", label: "Register POS", icon: ShoppingBag, testId: "nav-pos-register" },
    { to: "/pos/kitchen", label: "Kitchen Tickets", icon: CookingPot, testId: "nav-pos-kitchen" },
    { to: "/pos/display", label: "Customer Ticket Display", icon: Monitor, testId: "nav-pos-display" },
    { to: "/pos/printer-settings", label: "Printer Settings", icon: Settings, testId: "nav-printer-settings" },
  ]},
];

interface ModernSidebarProps { isOpen: boolean; onClose: () => void; isCollapsed?: boolean; onCollapseToggle?: () => void; className?: string; }

export function ModernSidebar({ isOpen, onClose, isCollapsed = false, onCollapseToggle, className }: ModernSidebarProps) {
  const location = useLocation();
  const { currentUser } = usePinAuth();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(navigationGroups.filter(g => g.defaultOpen).map(g => g.title)));

  useEffect(() => {
    const path = location.pathname;
    for (const group of navigationGroups) {
      if (group.items.some(item => path === item.to || path.startsWith(item.to + "/"))) {
        setOpenGroups(prev => { if (prev.has(group.title)) return prev; const next = new Set(prev); next.add(group.title); return next; });
        break;
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const closeOnMobile = () => { if (window.matchMedia("(max-width: 1023px)").matches) onClose(); };
  const toggleGroup = (title: string) => setOpenGroups(prev => { const next = new Set(prev); next.has(title) ? next.delete(title) : next.add(title); return next; });
  const isActive = (path: string) => path === "/dashboard" ? location.pathname === "/dashboard" : location.pathname.startsWith(path);
  const visibleGroups = navigationGroups.map(group => ({ ...group, items: group.items.filter(item => !item.ownerOnly || currentUser?.role === "owner") })).filter(group => group.items.length > 0);

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden" onClick={onClose} data-testid="sidebar-backdrop" />}
      <aside ref={sidebarRef} className={cn(
        "fixed left-0 top-0 z-50 h-full transform bg-[#080808] text-white transition-all duration-300 lg:z-40",
        "border-r-[3px] border-black shadow-[12px_0_30px_rgba(0,0,0,0.12)]",
        "rounded-r-[30px] overflow-hidden",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        "w-80", isCollapsed ? "lg:w-[78px]" : "lg:w-[268px]", className
      )}>
        <div className={cn("flex h-[72px] items-center border-b border-white/10", isCollapsed ? "justify-between px-4 lg:justify-center" : "justify-between px-5") }>
          <img src="/attached_assets/Yellow Circle - Black Logo_1757766401641.png" alt="SBB Logo" className={cn("object-contain rounded-xl", isCollapsed ? "h-9 w-9" : "h-10 w-10")} />
          {!isCollapsed && <button onClick={onCollapseToggle} className="hidden lg:flex h-8 w-8 items-center justify-center rounded-xl text-neutral-500 hover:bg-white/10 hover:text-white" aria-label="Collapse sidebar">‹</button>}
          <button onClick={onClose} className="lg:hidden flex h-8 w-8 items-center justify-center rounded-xl text-neutral-400 hover:bg-white/10 hover:text-white" data-testid="button-close-sidebar"><X className="h-4 w-4" /></button>
          {isCollapsed && <button onClick={onCollapseToggle} className="hidden lg:flex absolute top-16 left-1/2 -translate-x-1/2 h-7 w-7 items-center justify-center rounded-xl text-neutral-500 hover:bg-white/10 hover:text-white" aria-label="Expand sidebar">›</button>}
        </div>

        <nav className={cn("overflow-y-auto px-3 pt-4", isCollapsed ? "pb-24" : "pb-[220px]")} style={{ maxHeight: "calc(100vh - 72px)" }}>
          <NavLink to={homeNavItem.to} onClick={closeOnMobile} className={cn(
            "mb-3 flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-all",
            isCollapsed && "lg:justify-center lg:px-2",
            isActive(homeNavItem.to) ? "bg-[#FFD400] text-black shadow-[0_8px_24px_rgba(255,212,0,0.20)]" : "text-neutral-300 hover:bg-white/10 hover:text-white"
          )} data-testid={homeNavItem.testId}>
            <Home className="h-[18px] w-[18px] flex-shrink-0" /><span className={cn(isCollapsed && "lg:hidden")}>Home</span>
          </NavLink>

          {visibleGroups.map(group => {
            const isGroupOpen = openGroups.has(group.title);
            return <div key={group.title} className="mb-2">
              <button onClick={() => toggleGroup(group.title)} className={cn("w-full flex items-center justify-between rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-neutral-500 hover:bg-white/5 hover:text-neutral-300", isCollapsed && "lg:hidden")} aria-expanded={isGroupOpen}>
                <span>{group.title}</span><ChevronDown className={cn("h-3 w-3 transition-transform", isGroupOpen && "rotate-180")} />
              </button>
              <div className={cn("space-y-1 mt-1", !isGroupOpen && (isCollapsed ? "hidden lg:block" : "hidden"))}>
                {group.items.map(item => {
                  const active = isActive(item.to);
                  return <NavLink key={item.to} to={item.to} onClick={closeOnMobile} className={cn(
                    "group flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[12px] font-medium transition-all",
                    isCollapsed && "lg:justify-center lg:px-2",
                    item.subItem && !isCollapsed && "ml-4 w-[calc(100%-1rem)] pl-3",
                    active ? "bg-white text-black shadow-sm" : "text-neutral-400 hover:bg-white/10 hover:text-white"
                  )} data-testid={item.testId}>
                    <item.icon className={cn("h-4 w-4 flex-shrink-0", active ? "text-black" : "text-neutral-500 group-hover:text-white")} />
                    <span className={cn("truncate", isCollapsed && "lg:hidden")}>{item.label}</span>
                  </NavLink>;
                })}
              </div>
            </div>;
          })}
        </nav>

        {!isCollapsed && <div className="absolute bottom-5 left-4 right-4">
          <div className="rounded-[24px] border border-neutral-200 bg-white p-4 text-black shadow-[0_18px_40px_rgba(0,0,0,0.28)]">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#DFFF00] shadow-[0_0_24px_rgba(223,255,0,0.55)]"><Crown className="h-5 w-5 stroke-[2.4]" /></div>
            <h3 className="mt-4 text-xl font-bold tracking-tight">Upgrade to Premium</h3>
            <p className="mt-2 text-xs leading-5 text-neutral-500">Unlock advanced reporting, automation and premium business tools.</p>
            <button type="button" className="mt-4 w-full rounded-full bg-black px-4 py-3 text-xs font-bold text-white transition hover:bg-neutral-800">Upgrade to Premium</button>
          </div>
        </div>}
      </aside>
    </>
  );
}

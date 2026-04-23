/**
 * 🔒 NAVIGATION LOCK — APPROVED STRUCTURE
 * Date: Jan 28, 2026 | Updated: Apr 22, 2026 (FINAL DB 7 — owner approved)
 *
 * Sidebar sections are FINAL:
 * - Operations
 * - Purchasing
 * - Analysis
 * - Finance
 * - Menu Management
 * - AI Operations  ← added Apr 22, 2026 (moved from Operations, owner approved)
 *
 * Do NOT:
 * - Move Ingredient Authority out of Menu Management
 * - Add new root sections without explicit owner approval
 *
 * All navigation changes require explicit owner approval.
 */
import { NavLink, useLocation, Link } from "react-router-dom";
import { usePinAuth } from "@/components/PinLoginGate";
import { cn } from "@/lib/utils";
import { 
  Home, 
  BarChart3, 
  Receipt, 
  ShoppingCart, 
  Calculator,
  Settings,
  ChefHat,
  Bot,
  ChevronDown,
  X,
  ShoppingBag,
  Users,
  Package
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ModernButton } from "@/components/ui";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
  subItems?: NavItem[];
  external?: boolean;
  isButton?: boolean;
  ownerOnly?: boolean;
};

type NavGroup = {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
  isStandalone?: boolean;
};

/**
 * PHASE L — Navigation & Ownership Reset
 * 
 * CANONICAL OWNERSHIP:
 * - PURCHASING = items & stock (Purchasing Items, Purchasing Log)
 * - FINANCE = money only (Expenses, Profit & Loss)
 * - ANALYSIS = insight (Sales & Shift Analysis, Stock Review)
 * - MENU MANAGEMENT = sellables (Recipe Management, Menu Manager)
 * 
 * HIDDEN from sidebar (routes still accessible directly with read-only banner):
 * - F&B Analysis, Shopping List, Menu Master V3, Menu Admin, Daily Summary Reports
 */
const navigationGroups: NavGroup[] = [
  {
    title: "Dashboard Home",
    isStandalone: true,
    items: []
  },
  {
    title: "Online Ordering Button",
    isStandalone: true,
    items: [
      { to: "/order", label: "Online Ordering", icon: ShoppingBag, testId: "button-online-ordering", external: true, isButton: true }
    ]
  },
  {
    title: "Operations",
    items: [
      { 
        to: "/operations/daily-sales", 
        label: "Daily Sales & Stock", 
        icon: Receipt, 
        testId: "nav-daily-sales",
        subItems: [
          { to: "/operations/daily-sales-v2/library", label: "Library", icon: BarChart3, testId: "nav-sales-library", ownerOnly: true }
        ]
      },
      { to: "/operations/health-safety-audit", label: "Health & Safety Audit", icon: Settings, testId: "nav-health-safety" },
      { to: "/operations/staff", label: "Staff Operations", icon: Users, testId: "nav-staff-ops",
        subItems: [
          { to: "/operations/staff/management", label: "Staff Management", icon: Users, testId: "nav-staff-management" },
          { to: "/operations/staff/roster", label: "Weekly Roster", icon: Home, testId: "nav-staff-roster" },
          { to: "/operations/staff/cleaning", label: "Daily Cleaning", icon: Settings, testId: "nav-staff-cleaning" },
          { to: "/operations/staff/deep-cleaning", label: "Deep Cleaning", icon: Package, testId: "nav-staff-deep-cleaning" },
          { to: "/operations/staff/attendance", label: "Attendance Log", icon: Users, testId: "nav-staff-attendance" },
          { to: "/operations/staff/settings", label: "Settings", icon: Settings, testId: "nav-staff-settings" },
        ]
      }
    ]
  },
  {
    title: "Purchasing",
    items: [
      { to: "/operations/purchasing", label: "Purchasing Items", icon: ShoppingCart, testId: "nav-purchasing-list" },
      { to: "/operations/shopping-list", label: "Shopping List", icon: ShoppingCart, testId: "nav-shopping-list" },
      { to: "/operations/purchasing-shift-log", label: "Stock Order History", icon: Package, testId: "nav-purchasing-log" },
      // INTERNAL/ADMIN ONLY — route still active at /operations/ingredient-purchasing, hidden from normal nav
    ]
  },
  {
    title: "Analysis",
    items: [
      { to: "/analysis/daily-review", label: "Sales & Shift Analysis", icon: BarChart3, testId: "nav-daily-review" },
      { to: "/analysis/v2", label: "Sales & Shift Analysis V2", icon: BarChart3, testId: "nav-analysis-v2" },
      { to: "/analysis/grab-loyverse-monthly-reconciliation", label: "Grab vs Loyverse", icon: BarChart3, testId: "nav-grab-loyverse-reconciliation" },
      { to: "/analysis/receipts", label: "Receipts Analysis", icon: Receipt, testId: "nav-receipt-analysis" },
    ]
  },
  {
    title: "AI Operations",
    items: [
      { to: "/ai-ops/control", label: "AI Ops Control", icon: Bot, testId: "nav-ai-ops-control" },
      { to: "/ai-ops/issue-register", label: "Issue Register", icon: Settings, testId: "nav-issue-register" },
      { to: "/ai-ops/variance-monitor", label: "Variance Monitor", icon: BarChart3, testId: "nav-variance-monitor" },
    ]
  },
  {
    title: "Finance",
    items: [
      { to: "/finance/expenses", label: "Expenses", icon: Calculator, testId: "nav-expenses" },
      { to: "/finance/profit-loss", label: "Profit & Loss", icon: Calculator, testId: "nav-profit-loss" }
    ]
  },
  {
    title: "Menu Management",
    items: [
      { to: "/recipe-management", label: "Recipe Management", icon: ChefHat, testId: "nav-recipe-management" },
            { to: "/menu-management/ingredients", label: "Ingredients", icon: ChefHat, testId: "nav-ingredients" }
    ]
  },
  {
    title: "POS & Kitchen",
    items: [
      { to: "/pos", label: "POS Terminal", icon: Receipt, testId: "nav-pos" },
      { to: "/kds", label: "Kitchen Display", icon: ChefHat, testId: "nav-kds" }
    ]
  },
  {
    title: "Membership",
    items: [
      { to: "/membership/dashboard", label: "Member Dashboard", icon: Users, testId: "nav-member-dashboard" },
      { to: "/membership/register", label: "Registration Form", icon: Users, testId: "nav-member-register" }
    ]
  },
  {
    title: "Settings",
    items: [
      { to: "/settings/profile", label: "My Profile", icon: Users, testId: "nav-settings-profile" },
      { to: "/settings/staff-access", label: "Staff Access", icon: Settings, testId: "nav-settings-staff" },
    ]
  }
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
  const { currentUser, logout, hasPermission } = usePinAuth();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(navigationGroups.filter(g => g.defaultOpen).map(g => g.title))
  );

  // Auto-expand the group that contains the current active path
  useEffect(() => {
    const path = location.pathname;
    for (const group of navigationGroups) {
      if (group.isStandalone) continue;
      const hasActiveItem = group.items.some(item => {
        if (path === item.to || path.startsWith(item.to + "/")) return true;
        if (item.subItems?.some(sub => path === sub.to || path.startsWith(sub.to + "/"))) return true;
        return false;
      });
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

  // Handle Escape key and focus management
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscape);
    
    // Focus trap for accessibility
    const sidebar = sidebarRef.current;
    if (sidebar) {
      const focusableElements = sidebar.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      firstElement?.focus();
      
      const handleTabTrap = (e: KeyboardEvent) => {
        if (e.key === 'Tab') {
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement?.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement?.focus();
            }
          }
        }
      };
      
      sidebar.addEventListener('keydown', handleTabTrap);
      return () => {
        sidebar.removeEventListener('keydown', handleTabTrap);
        document.removeEventListener('keydown', handleEscape);
      };
    }
    
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const toggleGroup = (groupTitle: string) => {
    setOpenGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(groupTitle)) {
        newSet.delete(groupTitle);
      } else {
        newSet.add(groupTitle);
      }
      return newSet;
    });
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
          data-testid="sidebar-backdrop"
        />
      )}
      
      {/* Sidebar */}
      <div 
        ref={sidebarRef}
        className={cn(
          // Mobile: fixed overlay that slides in/out
          "fixed top-0 left-0 z-50 h-full w-80 bg-white border-r border-slate-200 transform transition-transform duration-300 dark:bg-slate-900 dark:border-slate-800",
          // Mobile visibility
          isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          // Desktop: always visible, positioned normally
          isCollapsed ? "lg:w-[72px]" : "lg:w-64",
          "lg:fixed lg:z-auto",
          className
        )}
      >
        {/* Header */}
        <div className={cn(
          "flex items-center border-b border-slate-200 dark:border-slate-800",
          isCollapsed ? "justify-between p-3" : "justify-between p-6"
        )}>
          <div className="flex items-center gap-3">
            <img 
              src="/attached_assets/Yellow Circle - Black Logo_1757766401641.png" 
              alt="Logo" 
              className={cn("w-[46px] h-[46px]", isCollapsed && "w-9 h-9")}
            />
          </div>

          <div className="flex items-center gap-2">
            <ModernButton
              variant="ghost"
              size="sm"
              onClick={onCollapseToggle}
              className={cn(isCollapsed ? "inline-flex" : "hidden lg:inline-flex")}
              data-testid="button-toggle-sidebar-collapse"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? ">" : "<"}
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
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-scroll p-4 space-y-2 sidebar-scroll" style={{maxHeight: "calc(100vh - 140px)"}}>
          {navigationGroups.map((group) => {
            const isGroupOpen = openGroups.has(group.title);
            
            return (
              <div key={group.title} className="space-y-1">
                {/* Standalone clickable heading */}
                {group.isStandalone && group.items.length === 0 ? (
                  group.title === "Dashboard Home" ? (
                    <NavLink
                      to="/dashboard"
                      onClick={onClose}
                      className="w-full flex items-center px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-50 transition-colors dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                      data-testid="nav-dashboard-home"
                    >
                      <span>{isCollapsed ? "Home" : group.title}</span>
                    </NavLink>
                  ) : null
                ) : !group.isStandalone && !isCollapsed && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-50 transition-colors dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                    aria-expanded={isGroupOpen}
                    aria-controls={`group-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                    data-testid={`group-toggle-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span>{group.title}</span>
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isGroupOpen ? "rotate-180" : "rotate-0"
                    )} />
                  </button>
                )}

                {/* Group items */}
                {((group.isStandalone && group.items.length > 0) || (!group.isStandalone && (isGroupOpen || isCollapsed))) && (
                  <div 
                    className={cn(
                      "space-y-1",
                      !group.isStandalone && "ml-2"
                    )}
                    id={`group-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {group.items.map((item) => {
                      const active = isActive(item.to);
                      /* Standalone items (e.g. Online Ordering) render as section-header-level
                         links — same font/colour as Operations/Purchasing/etc. headers.       */
                      if (group.isStandalone) {
                        const standaloneClass = cn(
                          "flex items-center gap-3 px-3 py-2 text-xs font-semibold transition-all duration-200 rounded-lg",
                          isCollapsed && "lg:justify-center lg:px-2",
                          active
                            ? "text-slate-900 bg-slate-100 dark:text-white dark:bg-slate-800"
                            : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
                        );
                        return (
                          <div key={item.to}>
                            {item.external ? (
                              <a href={item.to} onClick={onClose} target="_blank" rel="noopener noreferrer"
                                className={standaloneClass} data-testid={item.testId}>
                                <item.icon className="h-4 w-4 text-slate-500 transition-colors" />
                                <span className={cn("truncate", isCollapsed && "hidden lg:inline")}>{item.label}</span>
                              </a>
                            ) : (
                              <NavLink to={item.to} onClick={onClose}
                                className={standaloneClass} data-testid={item.testId}>
                                <item.icon className="h-4 w-4 text-slate-500 transition-colors" />
                                <span className={cn("truncate", isCollapsed && "hidden lg:inline")}>{item.label}</span>
                              </NavLink>
                            )}
                          </div>
                        );
                      }

                      return (
                        <div key={item.to}>
                          {/* Main item */}
                          {item.external ? (
                            <a
                              href={item.to}
                              onClick={onClose}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={cn(
                                "flex items-center gap-3 px-3 py-2 text-xs font-medium transition-all duration-200",
                                isCollapsed && "lg:justify-center lg:px-2",
                                item.isButton 
                                  ? "bg-black text-white hover:bg-gray-800 rounded-[4px]"
                                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg"
                              )}
                              data-testid={item.testId}
                            >
                              <item.icon className={cn(
                                "h-4 w-4 transition-colors",
                                item.isButton ? "text-white" : "text-slate-500"
                              )} />
                              <span className={cn("truncate", isCollapsed && "hidden lg:inline")}>{item.label}</span>
                            </a>
                          ) : (
                          <NavLink
                            to={item.to}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 text-xs font-medium transition-all duration-200",
                              isCollapsed && "lg:justify-center lg:px-2",
                              item.isButton
                                ? "bg-black text-white hover:bg-gray-800 rounded-[4px]"
                                : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg"
                            )}
                            data-testid={item.testId}
                          >
                            <item.icon className={cn(
                              "h-4 w-4 transition-colors",
                              item.isButton ? "text-white" : "text-slate-500"
                            )} />
                            <span className={cn("truncate", isCollapsed && "hidden lg:inline")}>{item.label}</span>
                          </NavLink>
                          )}
                          
                          {/* Sub-items if they exist */}
                          {item.subItems && (
                            <div className="ml-6 mt-1 space-y-1">
                              {item.subItems.filter(subItem => !subItem.ownerOnly || currentUser?.role === "owner").map((subItem) => {
                                const subActive = isActive(subItem.to);
                                
                                return (
                                  <div key={subItem.to}>
                                    <NavLink
                                      to={subItem.to}
                                      onClick={onClose}
                                      className={cn(
                                        "flex items-center gap-3 px-3 py-2 text-xs font-medium transition-all duration-200",
                                isCollapsed && "lg:justify-center lg:px-2",
                                        subActive
                                          ? "bg-black text-white rounded-[4px]"
                                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg"
                                      )}
                                      data-testid={subItem.testId}
                                    >
                                      <subItem.icon className={cn(
                                        "h-3 w-3 transition-colors",
                                        subActive ? "text-white" : "text-slate-400"
                                      )} />
                                      <span className={cn("truncate", isCollapsed && "hidden lg:inline")}>{subItem.label}</span>
                                    </NavLink>
                                    
                                    {/* Nested sub-items (third level) */}
                                    {subItem.subItems && (
                                      <div className="ml-6 mt-1 space-y-1">
                                        {subItem.subItems.map((nestedItem) => {
                                          const nestedActive = isActive(nestedItem.to);
                                          
                                          return (
                                            <NavLink
                                              key={nestedItem.to}
                                              to={nestedItem.to}
                                              onClick={onClose}
                                              className={cn(
                                                "flex items-center gap-3 px-3 py-2 text-xs font-medium transition-all duration-200",
                                isCollapsed && "lg:justify-center lg:px-2",
                                                nestedActive
                                                  ? "bg-black text-white rounded-[4px]"
                                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg"
                                              )}
                                              data-testid={nestedItem.testId}
                                            >
                                              <nestedItem.icon className={cn(
                                                "h-3 w-3 transition-colors",
                                                nestedActive ? "text-white" : "text-slate-400"
                                              )} />
                                              <span className={cn("truncate", isCollapsed && "hidden lg:inline")}>{nestedItem.label}</span>
                                            </NavLink>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer — version tag only (user is in the top bar) */}
        <div className={cn("border-t border-slate-200 dark:border-slate-800", isCollapsed ? "p-2" : "px-4 py-3")}>
          {!isCollapsed && (
            <p className="text-[10px] text-slate-400 dark:text-slate-600">Smash Brothers Dashboard</p>
          )}
        </div>
      </div>
    </>
  );
}

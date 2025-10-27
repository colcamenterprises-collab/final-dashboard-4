import { NavLink, useLocation } from "react-router-dom";
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
  ShoppingBag
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
};

type NavGroup = {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
  isStandalone?: boolean;
};

const navigationGroups: NavGroup[] = [
  {
    title: "Dashboard Home",
    isStandalone: true,
    defaultOpen: true,
    items: []
  },
  {
    title: "Operations",
    defaultOpen: true,
    items: [
      { 
        to: "/operations/daily-sales", 
        label: "Daily Sales & Stock", 
        icon: Receipt, 
        testId: "nav-daily-sales",
        subItems: [
          { to: "/operations/daily-sales-v2/library", label: "Library", icon: BarChart3, testId: "nav-sales-library" }
        ]
      },
      { to: "/operations/shopping-list", label: "Shopping List", icon: ShoppingCart, testId: "nav-shopping-list" },
      { 
        to: "/operations/analysis", 
        label: "Analysis", 
        icon: BarChart3, 
        testId: "nav-analysis",
        subItems: [
          { to: "/operations/analysis/shift-items", label: "Shift Analytics (MM v1.0)", icon: BarChart3, testId: "nav-shift-analytics-mm" },
          { to: "/analysis/daily-review", label: "Daily Review", icon: BarChart3, testId: "nav-daily-review" },
          { to: "/operations/analysis/stock-review", label: "Stock Review", icon: BarChart3, testId: "nav-stock-review" },
          { to: "/analysis/daily-sales", label: "Daily Sales Analysis", icon: BarChart3, testId: "nav-daily-sales-analysis" },
          { to: "/operations/analysis/loyverse", label: "POS Reporting", icon: BarChart3, testId: "nav-pos-reporting" }
        ]
      }
    ]
  },
  {
    title: "Finance",
    items: [
      { to: "/finance/profit-loss", label: "Profit & Loss", icon: Calculator, testId: "nav-profit-loss" },
      { to: "/finance/expenses", label: "Expenses", icon: Calculator, testId: "nav-expenses" }
    ]
  },
  {
    title: "Menu Management",
    items: [
      { to: "/menu/recipes", label: "Recipe Management", icon: ChefHat, testId: "nav-recipes" },
      { to: "/menu/ingredient-management", label: "Ingredient Mgmt", icon: Settings, testId: "nav-ingredients" },
      { to: "/menu/manager", label: "Menu Manager", icon: ChefHat, testId: "nav-menu-manager" }
    ]
  },
  {
    title: "AI Assistants",
    items: [
      { to: "/ai/jussi-ops", label: "Jussi (Operations)", icon: Bot, testId: "nav-jussi" },
      { to: "/ai/jane-accounts", label: "Jane (Accounting)", icon: Bot, testId: "nav-jane" }
    ]
  },
  {
    title: "Sales & Ordering",
    defaultOpen: true,
    items: [
      { to: "/order", label: "Online Ordering", icon: ShoppingBag, testId: "nav-online-ordering" },
      { to: "/marketing/menu-admin", label: "Menu Admin", icon: Settings, testId: "nav-menu-admin" }
    ]
  }
];

interface ModernSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function ModernSidebar({ isOpen, onClose, className }: ModernSidebarProps) {
  const location = useLocation();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    new Set(navigationGroups.filter(g => g.defaultOpen).map(g => g.title))
  );

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
          "lg:fixed lg:w-64 lg:z-auto",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <img 
              src="/attached_assets/Yellow Circle - Black Logo_1757766401641.png" 
              alt="Logo" 
              className="w-[46px] h-[46px]"
            />
          </div>
          
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
                      to="/"
                      onClick={onClose}
                      className="w-full flex items-center px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                      data-testid="nav-dashboard-home"
                    >
                      <span className="uppercase tracking-wider">{group.title}</span>
                    </NavLink>
                  ) : null
                ) : !group.isStandalone && (
                  <button
                    onClick={() => toggleGroup(group.title)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-50 transition-colors dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800"
                    aria-expanded={isGroupOpen}
                    aria-controls={`group-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                    data-testid={`group-toggle-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span className="uppercase tracking-wider">
                      {group.title}
                    </span>
                    <ChevronDown className={cn(
                      "h-3 w-3 transition-transform duration-200",
                      isGroupOpen ? "rotate-180" : "rotate-0"
                    )} />
                  </button>
                )}

                {/* Group items */}
                {!group.isStandalone && isGroupOpen && (
                  <div 
                    className="space-y-1 ml-2"
                    id={`group-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {group.items.map((item) => {
                      const active = isActive(item.to);
                      
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
                                item.isButton 
                                  ? "bg-black text-white hover:bg-gray-800 rounded-[9px]"
                                  : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg"
                              )}
                              data-testid={item.testId}
                            >
                              <item.icon className={cn(
                                "h-4 w-4 transition-colors",
                                item.isButton ? "text-white" : "text-slate-500"
                              )} />
                              <span className="truncate">{item.label}</span>
                            </a>
                          ) : (
                          <NavLink
                            to={item.to}
                            onClick={onClose}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 text-xs font-medium transition-all duration-200",
                              item.isButton
                                ? "bg-black text-white hover:bg-gray-800 rounded-[9px]"
                                : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg"
                            )}
                            data-testid={item.testId}
                          >
                            <item.icon className={cn(
                              "h-4 w-4 transition-colors",
                              item.isButton ? "text-white" : "text-slate-500"
                            )} />
                            <span className="truncate">{item.label}</span>
                          </NavLink>
                          )}
                          
                          {/* Sub-items if they exist */}
                          {item.subItems && (
                            <div className="ml-6 mt-1 space-y-1">
                              {item.subItems.map((subItem) => {
                                const subActive = isActive(subItem.to);
                                
                                return (
                                  <div key={subItem.to}>
                                    <NavLink
                                      to={subItem.to}
                                      onClick={onClose}
                                      className={cn(
                                        "flex items-center gap-3 px-3 py-2 text-xs font-medium transition-all duration-200",
                                        subActive
                                          ? "bg-black text-white rounded-[9px]"
                                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg"
                                      )}
                                      data-testid={subItem.testId}
                                    >
                                      <subItem.icon className={cn(
                                        "h-3 w-3 transition-colors",
                                        subActive ? "text-white" : "text-slate-400"
                                      )} />
                                      <span className="truncate">{subItem.label}</span>
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
                                                nestedActive
                                                  ? "bg-black text-white rounded-[9px]"
                                                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 rounded-lg"
                                              )}
                                              data-testid={nestedItem.testId}
                                            >
                                              <nestedItem.icon className={cn(
                                                "h-3 w-3 transition-colors",
                                                nestedActive ? "text-white" : "text-slate-400"
                                              )} />
                                              <span className="truncate">{nestedItem.label}</span>
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

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
            v2.0.1 • Modern Dashboard
          </div>
        </div>
      </div>
    </>
  );
}
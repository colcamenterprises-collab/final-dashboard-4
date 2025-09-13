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
  X
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { ModernButton } from "@/components/ui";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  testId: string;
};

type NavGroup = {
  title: string;
  items: NavItem[];
  defaultOpen?: boolean;
};

const navigationGroups: NavGroup[] = [
  {
    title: "Dashboard",
    defaultOpen: true,
    items: [
      { to: "/", label: "Home", icon: Home, testId: "nav-home" },
      { to: "/dashboard/overview", label: "Overview", icon: BarChart3, testId: "nav-overview" }
    ]
  },
  {
    title: "Operations",
    defaultOpen: true,
    items: [
      { to: "/operations/daily-sales", label: "Daily Sales & Stock", icon: Receipt, testId: "nav-daily-sales" },
      { to: "/operations/daily-sales-v2/library", label: "Sales Library", icon: BarChart3, testId: "nav-sales-library" },
      { to: "/operations/shopping-list", label: "Shopping List", icon: ShoppingCart, testId: "nav-shopping-list" },
      { to: "/operations/expenses", label: "Expenses", icon: Calculator, testId: "nav-expenses" }
    ]
  },
  {
    title: "Finance",
    items: [
      { to: "/finance", label: "Finance Dashboard", icon: BarChart3, testId: "nav-finance" },
      { to: "/finance/profit-loss", label: "Profit & Loss", icon: Calculator, testId: "nav-profit-loss" },
      { to: "/operations/analysis", label: "Analysis", icon: BarChart3, testId: "nav-analysis" }
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
          "fixed top-0 left-0 z-50 h-full w-80 bg-white border-r border-slate-200 transform transition-transform duration-300 lg:transform-none lg:relative lg:z-auto dark:bg-slate-900 dark:border-slate-800",
          isOpen ? "translate-x-0" : "-translate-x-full",
          "lg:w-64",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-lime-400 to-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">R</span>
            </div>
            <span className="text-lg font-semibold text-slate-900 dark:text-white">
              Restaurant
            </span>
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
        <nav className="flex-1 overflow-y-auto p-4 space-y-2">
          {navigationGroups.map((group) => {
            const isGroupOpen = openGroups.has(group.title);
            
            return (
              <div key={group.title} className="space-y-1">
                {/* Group header */}
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

                {/* Group items */}
                {isGroupOpen && (
                  <div 
                    className="space-y-1 ml-2"
                    id={`group-${group.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {group.items.map((item) => {
                      const active = isActive(item.to);
                      
                      return (
                        <NavLink
                          key={item.to}
                          to={item.to}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                            active
                              ? "bg-emerald-50 text-emerald-700 border-r-2 border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-400"
                              : "text-slate-700 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
                          )}
                          data-testid={item.testId}
                        >
                          <item.icon className={cn(
                            "h-4 w-4 transition-colors",
                            active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"
                          )} />
                          <span className="truncate">{item.label}</span>
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
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400 text-center">
            v2.0.1 • Modern Dashboard
          </div>
        </div>
      </div>
    </>
  );
}
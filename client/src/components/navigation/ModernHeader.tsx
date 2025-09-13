import { ModernButton } from "@/components/ui";
import { Search, Bell, Settings, Menu } from "lucide-react";
import { useState } from "react";

interface ModernHeaderProps {
  onMenuToggle?: () => void;
  title?: string;
  subtitle?: string;
}

export function ModernHeader({ onMenuToggle, title, subtitle }: ModernHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl dark:bg-slate-900/80 dark:border-slate-800">
      <div className="flex h-16 items-center justify-between px-4 lg:px-8">
        {/* Left section */}
        <div className="flex items-center gap-4">
          {/* Mobile menu button */}
          <ModernButton
            variant="ghost"
            size="sm"
            className="lg:hidden"
            onClick={onMenuToggle}
            data-testid="button-mobile-menu"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </ModernButton>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2">
          {/* Search toggle */}
          <ModernButton
            variant="ghost"
            size="sm"
            onClick={() => setSearchOpen(!searchOpen)}
            data-testid="button-search"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </ModernButton>

          {/* Notifications */}
          <ModernButton
            variant="ghost"
            size="sm"
            data-testid="button-notifications"
            aria-label="Notifications"
          >
            <Bell className="h-4 w-4" />
          </ModernButton>

          {/* Settings */}
          <ModernButton
            variant="ghost"
            size="sm"
            data-testid="button-settings"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </ModernButton>
        </div>
      </div>

      {/* Expandable search bar */}
      {searchOpen && (
        <div className="border-t bg-white dark:bg-slate-900 p-4 lg:px-8">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search transactions, reports..."
              aria-label="Search transactions and reports"
              className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              data-testid="input-search"
              autoFocus
            />
          </div>
        </div>
      )}
    </header>
  );
}
import { ModernButton } from "@/components/ui";
import { Search, Bell, Settings, Menu, LogOut, User } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { usePinAuth } from "@/components/PinLoginGate";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

interface ModernHeaderProps {
  onMenuToggle?: () => void;
  title?: string;
  subtitle?: string;
}

type ProfileUser = {
  id: number;
  name: string;
  role: string;
  avatarUrl: string | null;
};

function UserAvatar({ name, avatarUrl, size = 28 }: { name: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-slate-200"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size, fontSize: size / 2.4 }}
      className="rounded-full bg-emerald-900/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}

export function ModernHeader({ onMenuToggle }: ModernHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const lastOrderCountRef = useRef(0);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { currentUser, logout } = usePinAuth();

  const { data: profileData } = useQuery<{ user: ProfileUser }>({
    queryKey: ["/api/pin/me/profile"],
    queryFn: async () => {
      const r = await fetch("/api/pin/me/profile", { credentials: "include" });
      if (!r.ok) throw new Error("Failed");
      return r.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const profile = profileData?.user;
  const displayName = profile?.name ?? currentUser?.name ?? "";
  const displayRole = profile?.role ?? currentUser?.role ?? "";
  const avatarUrl = profile?.avatarUrl ?? null;

  // Close user menu on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showUserMenu]);

  // Poll for new orders every 10 seconds
  useEffect(() => {
    const checkNewOrders = async () => {
      try {
        const response = await fetch('/api/orders/today');
        if (response.ok) {
          const data = await response.json();
          const currentCount = data.totalOrders || 0;
          if (currentCount > lastOrderCountRef.current && lastOrderCountRef.current > 0) {
            const newOrders = currentCount - lastOrderCountRef.current;
            setNewOrderCount(prev => prev + newOrders);
            toast({
              title: "New Order!",
              description: `You have ${newOrders} new order${newOrders > 1 ? 's' : ''}!`,
              duration: 5000,
            });
          }
          lastOrderCountRef.current = currentCount;
        }
      } catch {}
    };
    checkNewOrders();
    const interval = setInterval(checkNewOrders, 10000);
    return () => clearInterval(interval);
  }, [toast]);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white/80 backdrop-blur-xl dark:bg-slate-900/80 dark:border-slate-800">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        {/* Left — mobile menu toggle */}
        <div className="flex items-center gap-3">
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

        {/* Right — icons + user */}
        <div className="flex items-center gap-1">
          {/* Search */}
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
            onClick={() => { setShowOrderPanel(!showOrderPanel); setNewOrderCount(0); }}
            data-testid="button-notifications"
            aria-label="Notifications"
            className="relative"
          >
            <Bell className={`h-4 w-4 ${newOrderCount > 0 ? 'animate-pulse text-emerald-600' : ''}`} />
            {newOrderCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                {newOrderCount > 9 ? '9+' : newOrderCount}
              </span>
            )}
          </ModernButton>

          {/* Settings */}
          <Link to="/settings/staff-access">
            <ModernButton
              variant="ghost"
              size="sm"
              data-testid="button-settings"
              aria-label="Settings"
            >
              <Settings className="h-4 w-4" />
            </ModernButton>
          </Link>

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

          {/* User avatar + dropdown */}
          {displayName && (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="User menu"
              >
                <UserAvatar name={displayName} avatarUrl={avatarUrl} size={28} />
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 leading-tight">{displayName}</p>
                  <p className="text-[10px] capitalize text-slate-400 leading-tight">{displayRole}</p>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900 py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{displayName}</p>
                    <p className="text-[10px] capitalize text-slate-400">{displayRole}</p>
                  </div>
                  <Link
                    to="/settings/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <User className="h-3.5 w-3.5" />
                    My Profile
                  </Link>
                  {(currentUser?.role === "owner" || currentUser?.role === "manager") && (
                    <Link
                      to="/settings/staff-access"
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-2 px-3 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Staff Access
                    </Link>
                  )}
                  <div className="border-t border-slate-100 dark:border-slate-800 mt-1 pt-1">
                    <button
                      onClick={() => { setShowUserMenu(false); logout(); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Expandable search bar */}
      {searchOpen && (
        <div className="border-t bg-white dark:bg-slate-900 p-4 lg:px-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search transactions, reports..."
              aria-label="Search transactions and reports"
              className="w-full pl-10 pr-4 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              data-testid="input-search"
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Order notifications panel */}
      {showOrderPanel && (
        <div className="absolute right-4 top-14 z-50 w-80 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-sm">Recent Orders</h3>
          </div>
          <div className="p-4 text-sm text-slate-600 dark:text-slate-400 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2 text-slate-400" />
            <p className="text-xs">Order notifications appear here</p>
          </div>
        </div>
      )}
    </header>
  );
}

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

function UserAvatar({ name, avatarUrl, size = 32 }: { name: string; avatarUrl: string | null; size?: number }) {
  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover border border-white/20" />;
  }
  return (
    <div style={{ width: size, height: size, fontSize: size / 2.4 }} className="rounded-full bg-[#FFD400] text-black flex items-center justify-center font-bold flex-shrink-0">
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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setShowUserMenu(false);
    }
    if (showUserMenu) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [showUserMenu]);

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
            toast({ title: "New Order!", description: `You have ${newOrders} new order${newOrders > 1 ? 's' : ''}!`, duration: 5000 });
          }
          lastOrderCountRef.current = currentCount;
        }
      } catch {}
    };
    checkNewOrders();
    const interval = setInterval(checkNewOrders, 10000);
    return () => clearInterval(interval);
  }, [toast]);

  const iconButton = "h-9 w-9 rounded-xl text-neutral-300 hover:text-white hover:bg-white/10";

  return (
    <header className="sticky top-0 z-50 w-full bg-[#080808] text-white shadow-[0_10px_30px_rgba(0,0,0,0.16)]">
      <div className="flex h-[72px] items-center justify-between px-4 sm:px-5 lg:px-7">
        <div className="flex items-center gap-3 min-w-0">
          <ModernButton variant="ghost" size="sm" className={`lg:hidden ${iconButton}`} onClick={onMenuToggle} data-testid="button-mobile-menu" aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </ModernButton>
          <div className="hidden md:block">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">Smash Brothers Burgers</p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-100">Restaurant Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <ModernButton variant="ghost" size="sm" onClick={() => setSearchOpen(!searchOpen)} data-testid="button-search" aria-label="Search" className={iconButton}>
            <Search className="h-[17px] w-[17px]" />
          </ModernButton>
          <ModernButton variant="ghost" size="sm" onClick={() => { setShowOrderPanel(!showOrderPanel); setNewOrderCount(0); }} data-testid="button-notifications" aria-label="Notifications" className={`relative ${iconButton}`}>
            <Bell className={`h-[17px] w-[17px] ${newOrderCount > 0 ? 'animate-pulse text-[#FFD400]' : ''}`} />
            {newOrderCount > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FFD400] px-1 text-[9px] font-black text-black">{newOrderCount > 9 ? '9+' : newOrderCount}</span>}
          </ModernButton>
          <Link to="/settings/staff-access"><ModernButton variant="ghost" size="sm" data-testid="button-settings" aria-label="Settings" className={iconButton}><Settings className="h-[17px] w-[17px]" /></ModernButton></Link>
          <div className="mx-2 h-7 w-px bg-white/10" />

          {displayName && (
            <div className="relative" ref={userMenuRef}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/10 transition-colors" aria-label="User menu">
                <UserAvatar name={displayName} avatarUrl={avatarUrl} size={32} />
                <div className="hidden sm:block text-left pr-1">
                  <p className="text-xs font-semibold text-white leading-tight">{displayName}</p>
                  <p className="text-[10px] capitalize text-neutral-500 leading-tight mt-0.5">{displayRole}</p>
                </div>
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl py-1 z-50">
                  <div className="px-4 py-3 border-b border-neutral-100"><p className="text-xs font-semibold">{displayName}</p><p className="text-[10px] capitalize text-neutral-400 mt-0.5">{displayRole}</p></div>
                  <Link to="/settings/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-xs text-neutral-600 hover:bg-neutral-50"><User className="h-3.5 w-3.5" />My Profile</Link>
                  {(currentUser?.role === "owner" || currentUser?.role === "manager") && <Link to="/settings/staff-access" onClick={() => setShowUserMenu(false)} className="flex items-center gap-2 px-4 py-2.5 text-xs text-neutral-600 hover:bg-neutral-50"><Settings className="h-3.5 w-3.5" />Staff Access</Link>}
                  <div className="border-t border-neutral-100 mt-1 pt-1"><button onClick={() => { setShowUserMenu(false); logout(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-xs text-red-600 hover:bg-red-50"><LogOut className="h-3.5 w-3.5" />Sign Out</button></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="border-t border-white/10 bg-[#080808] px-4 pb-4 pt-3 lg:px-7">
          <div className="relative max-w-xl"><Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" /><input type="search" placeholder="Search transactions, reports..." aria-label="Search transactions and reports" className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-xs text-white outline-none placeholder:text-neutral-600 focus:border-[#FFD400]/60" data-testid="input-search" autoFocus /></div>
        </div>
      )}

      {showOrderPanel && (
        <div className="absolute right-4 top-[68px] z-50 w-80 overflow-hidden rounded-2xl border border-neutral-200 bg-white text-neutral-900 shadow-2xl"><div className="p-4 border-b border-neutral-100"><h3 className="font-semibold text-sm">Recent Orders</h3></div><div className="p-5 text-sm text-neutral-500 text-center"><Bell className="h-8 w-8 mx-auto mb-2 text-neutral-300" /><p className="text-xs">Order notifications appear here</p></div></div>
      )}
    </header>
  );
}

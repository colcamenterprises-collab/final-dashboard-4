import { ModernButton } from "@/components/ui";
import { Search, Bell, Settings, Menu } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface ModernHeaderProps {
  onMenuToggle?: () => void;
  title?: string;
  subtitle?: string;
}

export function ModernHeader({ onMenuToggle, title, subtitle }: ModernHeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [showOrderPanel, setShowOrderPanel] = useState(false);
  const lastOrderCountRef = useRef(0);
  const { toast } = useToast();
  
  // Poll for new orders every 10 seconds
  useEffect(() => {
    const checkNewOrders = async () => {
      try {
        const response = await fetch('/api/orders/today');
        if (response.ok) {
          const data = await response.json();
          const currentCount = data.totalOrders || 0;
          
          // Check if there are NEW orders since last check
          if (currentCount > lastOrderCountRef.current && lastOrderCountRef.current > 0) {
            const newOrders = currentCount - lastOrderCountRef.current;
            setNewOrderCount(prev => prev + newOrders);
            
            // Play notification sound
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGWm98OScSwkOVqzn77FeFQlBme' + 'DwwXEiBjiO1fPPejMGJHO+8N+PPgsPWLXq6qNPEQxJoeDvwGwhBzGB0fPTgjUHGWi67OSkTwwOVqzn77FeFQlBmeDwwXEiBjiO1fPPejMGJHO+8N+PPgsPWLXq6qNPEQxJoeDvwGwhBzGB0fPTgjUHGWi67OSkTwwOVqzn77FeFQlBmeDwwXEiBjiO1fPPejMGJHO+8N+PPgsPWLXq6qNPEQxJoeDvwGwhBzGB0fPTgjUHGWi67OSkTwwOVqzn77FeFQk=');
            audio.play().catch(() => {}); // Ignore if audio fails
            
            // Show toast notification
            toast({
              title: "🔔 New Order!",
              description: `You have ${newOrders} new order${newOrders > 1 ? 's' : ''}!`,
              duration: 5000,
            });
          }
          
          lastOrderCountRef.current = currentCount;
        }
      } catch (error) {
        console.error('Failed to check orders:', error);
      }
    };
    
    // Initial check
    checkNewOrders();
    
    // Poll every 10 seconds
    const interval = setInterval(checkNewOrders, 10000);
    
    return () => clearInterval(interval);
  }, [toast]);

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
            onClick={() => {
              setShowOrderPanel(!showOrderPanel);
              setNewOrderCount(0); // Clear badge when opened
            }}
            data-testid="button-notifications"
            aria-label="Notifications"
            className="relative"
          >
            <Bell className={`h-4 w-4 ${newOrderCount > 0 ? 'animate-pulse text-emerald-600' : ''}`} />
            {newOrderCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {newOrderCount > 9 ? '9+' : newOrderCount}
              </span>
            )}
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
      
      {/* Order notifications panel */}
      {showOrderPanel && (
        <div className="absolute right-4 top-16 z-50 w-80 rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700">
            <h3 className="font-semibold text-sm">Recent Orders</h3>
          </div>
          <div className="p-4 text-sm text-slate-600 dark:text-slate-400 text-center">
            <Bell className="h-8 w-8 mx-auto mb-2 text-slate-400" />
            <p>Order notifications will appear here</p>
            <p className="text-xs mt-1">Checking for new orders every 10 seconds</p>
          </div>
        </div>
      )}
    </header>
  );
}
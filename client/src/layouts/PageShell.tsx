import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { ModernHeader, ModernSidebar, BottomNav } from "@/components/navigation";
import DataConfidenceBanner from "@/components/DataConfidenceBanner";
import { cn } from "@/lib/utils";

export default function PageShell() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    const savedState = window.localStorage.getItem("sidebarCollapsed");
    if (savedState === "true") {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const handleSidebarCollapseToggle = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("sidebarCollapsed", String(next));
      return next;
    });
  };

  return (
    <div className="h-dvh bg-slate-50 dark:bg-slate-900">
      {/* Single Modern Sidebar - handles both desktop and mobile */}
      <ModernSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onCollapseToggle={handleSidebarCollapseToggle}
      />

      {/* Modern layout shell */}
      <div
        className={cn(
          "flex h-dvh transition-[margin] duration-300",
          isSidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-64"
        )}
      >
        {/* Main content area */}
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Modern Header */}
          <ModernHeader
            onMenuToggle={() => setSidebarOpen(true)}
            title="Restaurant Dashboard"
            subtitle="Manage your operations efficiently"
          />

          {/* Data Confidence Banner */}
          <DataConfidenceBanner />

          {/* Content with proper scrolling */}
          <main className="flex-1 overflow-y-scroll bg-slate-50 dark:bg-slate-900">
            <div className="px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <BottomNav />
    </div>
  );
}

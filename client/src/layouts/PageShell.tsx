import { useState } from "react";
import { Outlet } from "react-router-dom";
import { ModernHeader, ModernSidebar, BottomNav } from "@/components/navigation";
import DataConfidenceBanner from "@/components/DataConfidenceBanner";

export default function PageShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="h-dvh bg-slate-50 dark:bg-slate-900">
      {/* Single Modern Sidebar - handles both desktop and mobile */}
      <ModernSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Modern layout shell */}
      <div className="flex h-dvh lg:ml-64">
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
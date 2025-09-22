import { useState } from "react";
import { ModernHeader, ModernSidebar, BottomNav } from "@/components/navigation";

export default function PageShell({ children }: { children: React.ReactNode }) {
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

          {/* Content with proper scrolling */}
          <main className="flex-1 min-h-0 overflow-auto bg-slate-50 dark:bg-slate-900">
            <div className="px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <BottomNav />
    </div>
  );
}
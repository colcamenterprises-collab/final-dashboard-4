import { useState } from "react";
import { ModernHeader, ModernSidebar, BottomNav } from "@/components/navigation";

export default function PageShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Modern layout shell */}
      <div className="flex h-screen overflow-hidden">
        {/* Modern Sidebar - Desktop & Mobile */}
        <ModernSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          className="hidden lg:flex lg:flex-shrink-0"
        />

        {/* Main content area */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Modern Header */}
          <ModernHeader
            onMenuToggle={() => setSidebarOpen(true)}
            title="Restaurant Dashboard"
            subtitle="Manage your operations efficiently"
          />

          {/* Content with proper scrolling */}
          <main className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900">
            <div className="px-4 sm:px-6 lg:px-8 py-6 pb-20 lg:pb-6">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <BottomNav />

      {/* Mobile Sidebar Overlay */}
      <ModernSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        className="lg:hidden"
      />
    </div>
  );
}
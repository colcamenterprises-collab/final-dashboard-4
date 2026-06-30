import { useState } from "react";
import { Outlet } from "react-router-dom";
import { ModernHeader, ModernSidebar } from "@/components/navigation";
import DataConfidenceBanner from "@/components/DataConfidenceBanner";
import { cn } from "@/lib/utils";
import { usePinAuth } from "@/components/PinLoginGate";

export default function PageShell() {
  usePinAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const handleSidebarCollapseToggle = () => {
    setIsSidebarCollapsed((prev) => !prev);
  };

  return (
    <div className="h-dvh bg-neutral-100">
      {/* Sidebar */}
      <ModernSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onCollapseToggle={handleSidebarCollapseToggle}
      />

      {/* Main layout — offset by sidebar width */}
      <div
        className={cn(
          "flex h-dvh transition-[margin] duration-300",
          isSidebarCollapsed ? "lg:ml-[72px]" : "lg:ml-64"
        )}
      >
        <div className="flex min-h-0 flex-1 flex-col">
          {/* Header */}
          <ModernHeader
            onMenuToggle={() => setSidebarOpen(true)}
            title="Restaurant Dashboard"
            subtitle="Manage your operations efficiently"
          />

          {/* Data Confidence Banner */}
          <DataConfidenceBanner />

          {/* Content */}
          <main className="flex-1 overflow-y-scroll bg-neutral-100">
            <div className="px-4 sm:px-5 lg:px-6 py-5 pb-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

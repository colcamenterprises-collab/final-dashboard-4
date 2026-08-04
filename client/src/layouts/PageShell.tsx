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

  const handleSidebarCollapseToggle = () => setIsSidebarCollapsed((prev) => !prev);

  return (
    <div className="h-dvh overflow-hidden bg-[#080808]">
      <ModernSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onCollapseToggle={handleSidebarCollapseToggle}
      />

      <div className={cn(
        "flex h-dvh transition-[margin] duration-300",
        isSidebarCollapsed ? "lg:ml-[78px]" : "lg:ml-[268px]"
      )}>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#080808]">
          <ModernHeader onMenuToggle={() => setSidebarOpen(true)} title="Restaurant Dashboard" subtitle="Manage your operations efficiently" />
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-tl-[30px] border-l-[3px] border-t-[3px] border-black bg-neutral-100 shadow-[-14px_-10px_34px_rgba(0,0,0,0.18)]">
            <DataConfidenceBanner />
            <main className="flex-1 overflow-y-scroll bg-neutral-100">
              <div className="px-4 py-5 pb-8 sm:px-5 lg:px-7 lg:py-6">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

import React from "react";
import Sidebar from "./Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F5F7F8] text-slate-900">
      <div className="flex">
        <Sidebar />
        {/* Page content */}
        <main
          className="
            flex-1 min-w-0
            px-6 md:px-8
            pt-8 md:pt-10
            pb-10
          "
        >
          {children}
        </main>
      </div>
    </div>
  );
}
/**
 * ⚠️ LOCKED FILE — Do not replace or refactor without Cam's written approval.
 * This is the FINAL implementation used in production. All alternatives were removed on purpose.
 */

import { ReactNode } from "react";
import Sidebar from "./Sidebar";

interface PageShellProps {
  children: ReactNode;
}

export default function PageShell({ children }: PageShellProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
}
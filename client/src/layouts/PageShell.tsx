import { useState } from "react";
import Sidebar from "../components/Sidebar";

export default function PageShell({ children }: { children: React.ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f5f7f8]">
      {/* Shell */}
      <div className="flex">
        {/* Sidebar renders desktop+mobile variants internally */}
        <Sidebar
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onNavigate={() => setMenuOpen(false)}
        />

        {/* Main column */}
        <div className="flex-1 min-w-0 md:ml-0">
          {/* Top bar */}
          <header className="sticky top-0 z-20 bg-[#f5f7f8]/80 backdrop-blur border-b border-gray-200">
            <div className="px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
              {/* Mobile menu button */}
              <button
                className="p-2 rounded-md hover:bg-gray-100 md:hidden"
                aria-label="Open menu"
                onClick={() => setMenuOpen(true)}
              >
                ☰
              </button>
              {/* Page title placeholder; your pages can slot their own titles */}
              <div className="text-[22px] font-extrabold text-slate-900">
                {/* Individual pages typically render their own <h1>— this keeps space consistent */}
              </div>
              <div className="ml-auto flex items-center gap-3">
                {/* right side actions if any */}
              </div>
            </div>
          </header>

          {/* Content */}
          <main className="px-4 sm:px-6 lg:px-8 py-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
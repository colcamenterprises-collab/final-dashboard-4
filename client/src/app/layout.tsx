import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/toaster';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
});

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div className="min-h-screen bg-gray-50 flex">
          {/* Sidebar */}
          <div 
            className={`bg-white border-r border-gray-200 transition-all duration-300 ease-in-out ${
              sidebarOpen ? 'w-64' : 'w-18'
            }`}
          >
            <div className="p-4">
              {/* Sidebar Header with Toggle */}
              <div className="flex items-center justify-between mb-6">
                {sidebarOpen && (
                  <div className="text-lg font-bold text-gray-900">
                    Smash Brothers
                  </div>
                )}
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-4 h-4 flex flex-col justify-between">
                    <div className="h-0.5 bg-gray-600"></div>
                    <div className="h-0.5 bg-gray-600"></div>
                    <div className="h-0.5 bg-gray-600"></div>
                  </div>
                </button>
              </div>

              {/* Navigation */}
              <nav className="space-y-2">
                <a
                  href="/dashboard"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-5 h-5 bg-teal-600 rounded"></div>
                  {sidebarOpen && <span>Dashboard</span>}
                </a>
                <a
                  href="/daily-sales"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-5 h-5 bg-orange-500 rounded"></div>
                  {sidebarOpen && <span>Daily Sales</span>}
                </a>
                <a
                  href="/receipts"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-5 h-5 bg-blue-500 rounded"></div>
                  {sidebarOpen && <span>Receipts</span>}
                </a>
                <a
                  href="/expenses"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-5 h-5 bg-red-500 rounded"></div>
                  {sidebarOpen && <span>Expenses</span>}
                </a>
                <a
                  href="/system-status"
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <div className="w-5 h-5 bg-green-500 rounded"></div>
                  {sidebarOpen && <span>System Status</span>}
                </a>
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {children}
          </div>
        </div>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
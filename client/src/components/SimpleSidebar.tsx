import { useState } from 'react';
import { Link, useLocation } from 'wouter';

interface SimpleSidebarProps {
  children: React.ReactNode;
}

export default function SimpleSidebar({ children }: SimpleSidebarProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [location] = useLocation();

  return (
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
            <Link
              href="/"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                location === '/' ? 'bg-teal-100 text-teal-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="w-5 h-5 bg-teal-600 rounded"></div>
              {sidebarOpen && <span>Dashboard</span>}
            </Link>
            <Link
              href="/daily-sales"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                location === '/daily-sales' ? 'bg-orange-100 text-orange-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="w-5 h-5 bg-orange-500 rounded"></div>
              {sidebarOpen && <span>Daily Sales Form</span>}
            </Link>
            <Link
              href="/daily-stock-sales"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                location === '/daily-stock-sales' ? 'bg-purple-100 text-purple-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="w-5 h-5 bg-purple-500 rounded"></div>
              {sidebarOpen && <span>Daily Stock Form</span>}
            </Link>
            <Link
              href="/receipts"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                location === '/receipts' ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="w-5 h-5 bg-blue-500 rounded"></div>
              {sidebarOpen && <span>Receipts</span>}
            </Link>
            <Link
              href="/expenses"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                location === '/expenses' ? 'bg-red-100 text-red-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="w-5 h-5 bg-red-500 rounded"></div>
              {sidebarOpen && <span>Expenses</span>}
            </Link>
            <Link
              href="/system-status"
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                location === '/system-status' ? 'bg-green-100 text-green-700' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="w-5 h-5 bg-green-500 rounded"></div>
              {sidebarOpen && <span>System Status</span>}
            </Link>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}
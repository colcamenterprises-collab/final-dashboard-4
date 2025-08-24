import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Suspense, useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PageShell from "./layouts/PageShell";
import Sidebar from "./components/Sidebar";
import NotFound from "./pages/NotFound";
import { Menu } from "lucide-react";

// Pages
import Home from "./pages/Home";
import Analysis from "./pages/Analysis";
import Overview from "./pages/dashboard/Overview";
import DailySalesStock from "./pages/operations/DailySalesStock";
import DailySalesLibrary from "./pages/operations/DailySalesLibrary";
import Receipts from "./pages/Receipts";
import ShiftSummary from "./pages/operations/analysis/ShiftSummary";
import UploadStatements from "./pages/UploadStatements";
import ProfitLoss from "./pages/ProfitLoss";
import CostCalculator from "./pages/CostCalculator";
import Ingredients from "./pages/Ingredients";
import ExpensesMerged from "./pages/ExpensesMerged";
import MenuManager from "./pages/menu/MenuManager";
import MenuImport from "./pages/menu/MenuImport";
import DescriptionTool from "./pages/menu/DescriptionTool";
import ShiftReports from "./pages/ShiftReports";
import NightlyChecklist from "./pages/NightlyChecklist";
import JussiOps from "./pages/JussiOps";
import JaneAccounts from "./pages/JaneAccounts";
import DailySales from "./pages/DailySales";
import DailyStock from "./pages/operations/DailyStock";
import PosUpload from "./pages/analysis/PosUpload";
import ShiftAnalysis from "./pages/analysis/ShiftAnalysis";
import PosReceipts from "./pages/analysis/PosReceipts";

import { isAllowedPath, ROUTES } from "./router/RouteRegistry";

function Guard({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  return isAllowedPath(pathname) ? children : <NotFound />;
}

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-neutral-50">
            {/* Mobile/Tablet Header Bar - REMOVED */}

            {/* Floating Menu Button for Mobile */}
            <button
              className="fixed top-4 left-4 z-50 p-3 bg-emerald-600 text-white rounded-full shadow-lg lg:hidden"
              aria-label="Toggle menu"
              onClick={() => setSidebarOpen(v => !v)}
            >
              <Menu size={20} />
            </button>

            <div className="flex">
              {/* Sidebar */}
              <Sidebar 
                className={[
                  "fixed top-0 bottom-0 w-72 z-40 transform transition-transform duration-200",
                  sidebarOpen ? "translate-x-0" : "-translate-x-full",
                  "lg:static lg:top-0 lg:translate-x-0 lg:w-64"
                ].join(" ")}
                onClose={() => setSidebarOpen(false)}
              />

              {/* Mobile overlay */}
              {sidebarOpen && (
                <div
                  className="fixed inset-0 bg-black/30 z-30 lg:hidden"
                  onClick={() => setSidebarOpen(false)}
                />
              )}

              {/* Main content */}
              <div className="flex-1 lg:ml-0">
                <PageShell>
                  <Suspense fallback={<div className="p-6">Loading…</div>}>
                <Routes>
                  {/* Home */}
                  <Route path={ROUTES.HOME} element={<Guard><Home /></Guard>} />
                  
                  {/* Legacy Dashboard route */}
                  <Route path={ROUTES.OVERVIEW} element={<Guard><Overview /></Guard>} />

                  {/* Operations */}
                  <Route path={ROUTES.DAILY_SALES_LIBRARY} element={<Guard><DailySalesLibrary /></Guard>} />
                  
                  {/* ---- FORM 1: canonical + aliases ---- */}
                  <Route path="/operations/daily-sales" element={<DailySales />} />
                  <Route path="/daily-sales" element={<Navigate to="/operations/daily-sales" replace />} />
                  <Route path="/operations/daily-sales-stock" element={<Navigate to="/operations/daily-sales" replace />} />

                  {/* ---- FORM 2: canonical + aliases ---- */}
                  <Route path="/operations/stock" element={<Guard><DailyStock /></Guard>} />
                  <Route path="/operations/form2" element={<Navigate to="/operations/stock" replace />} />
                  
                  {/* Analysis with nested routes */}
                  <Route path={ROUTES.ANALYSIS} element={<Guard><Analysis /></Guard>}>
                    <Route path="upload" element={<UploadStatements />} />
                    <Route path="receipts" element={<Receipts />} />
                    <Route path="pos-upload" element={<PosUpload />} />
                    <Route path="shift-analysis" element={<ShiftAnalysis />} />
                    <Route path="pos-receipts" element={<PosReceipts />} />
                  </Route>
                  
                  {/* Legacy direct routes */}
                  <Route path={ROUTES.UPLOAD_STATEMENTS} element={<Guard><UploadStatements /></Guard>} />
                  <Route path={ROUTES.RECEIPTS} element={<Guard><Receipts /></Guard>} />
                  <Route path={ROUTES.SHIFT_SUMMARY} element={<Guard><ShiftSummary /></Guard>} />
                  <Route path={ROUTES.EXPENSES} element={<Guard><ExpensesMerged /></Guard>} />
                  <Route path={ROUTES.SHIFT_REPORTS} element={<Guard><ShiftReports /></Guard>} />

                  {/* Finance */}
                  <Route path={ROUTES.PROFIT_LOSS} element={<Guard><ProfitLoss /></Guard>} />

                  {/* Menu Mgmt */}
                  <Route path={ROUTES.COST_CALCULATOR} element={<Guard><CostCalculator /></Guard>} />
                  <Route path={ROUTES.INGREDIENTS} element={<Guard><Ingredients /></Guard>} />
                  <Route path={ROUTES.MENU_MGR} element={<Guard><MenuManager /></Guard>} />
                  <Route path={ROUTES.MENU_IMPORT} element={<Guard><MenuImport /></Guard>} />
                  <Route path={ROUTES.MENU_DESC_TOOL} element={<Guard><DescriptionTool /></Guard>} />

                  {/* Managers */}
                  <Route path={ROUTES.NIGHTLY_CHECKLIST} element={<Guard><NightlyChecklist /></Guard>} />
                  <Route path={ROUTES.JUSSI_AI} element={<Guard><JussiOps /></Guard>} />
                  <Route path={ROUTES.JANE_ACCOUNTS} element={<Guard><JaneAccounts /></Guard>} />

                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
              </PageShell>
              </div>
            </div>
          </div>
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
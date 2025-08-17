import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PageShell from "./layouts/PageShell";
import Sidebar from "./components/Sidebar";
import NotFound from "./pages/NotFound";

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
import Expenses from "./pages/Expenses";
import MenuManager from "./pages/menu/MenuManager";
import MenuImport from "./pages/menu/MenuImport";
import DescriptionTool from "./pages/menu/DescriptionTool";
import ShiftReports from "./pages/ShiftReports";
import NightlyChecklist from "./pages/NightlyChecklist";
import JussiOps from "./pages/JussiOps";
import JaneAccounts from "./pages/JaneAccounts";

import { isAllowedPath, ROUTES } from "./router/RouteRegistry";

function Guard({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  return isAllowedPath(pathname) ? children : <NotFound />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <div className="min-h-screen w-full flex bg-neutral-50">
            <Sidebar />
            <PageShell>
              <Suspense fallback={<div className="p-6">Loading…</div>}>
                <Routes>
                  {/* Home */}
                  <Route path={ROUTES.HOME} element={<Guard><Home /></Guard>} />
                  
                  {/* Legacy Dashboard route */}
                  <Route path={ROUTES.OVERVIEW} element={<Guard><Overview /></Guard>} />

                  {/* Operations */}
                  <Route path={ROUTES.DAILY_SALES_STOCK} element={<Guard><DailySalesStock /></Guard>} />
                  <Route path={ROUTES.DAILY_SALES_LIBRARY} element={<Guard><DailySalesLibrary /></Guard>} />
                  
                  {/* Analysis with nested routes */}
                  <Route path={ROUTES.ANALYSIS} element={<Guard><Analysis /></Guard>}>
                    <Route path="upload" element={<UploadStatements />} />
                    <Route path="receipts" element={<Receipts />} />
                  </Route>
                  
                  {/* Legacy direct routes */}
                  <Route path={ROUTES.UPLOAD_STATEMENTS} element={<Guard><UploadStatements /></Guard>} />
                  <Route path={ROUTES.RECEIPTS} element={<Guard><Receipts /></Guard>} />
                  <Route path={ROUTES.SHIFT_SUMMARY} element={<Guard><ShiftSummary /></Guard>} />
                  <Route path={ROUTES.EXPENSES} element={<Guard><Expenses /></Guard>} />
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
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
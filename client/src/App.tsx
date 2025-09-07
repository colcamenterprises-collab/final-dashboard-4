import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PageShell from "./layouts/PageShell";
import NotFound from "./pages/NotFound";

// Pages
import Home from "./pages/Home";
import Analysis from "./pages/Analysis";
import Overview from "./pages/dashboard/Overview";
import DailySalesStock from "./pages/operations/DailySalesStock";
import DailySalesV2Library from "./pages/operations/daily-sales-v2/Library";
import ShoppingListPage from "./pages/operations/shopping-list";
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
import DailySalesForm from "./pages/operations/daily-sales/Form";
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
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrowserRouter>
          <PageShell>
                  <Suspense fallback={<div className="p-6">Loading…</div>}>
                <Routes>
                  {/* Home */}
                  <Route path={ROUTES.HOME} element={<Guard><Home /></Guard>} />
                  
                  {/* Legacy Dashboard route */}
                  <Route path={ROUTES.OVERVIEW} element={<Guard><Overview /></Guard>} />

                  {/* Operations */}
                  <Route path={ROUTES.DAILY_SALES_LIBRARY} element={<Guard><DailySalesV2Library /></Guard>} />
                  <Route path="/operations/daily-sales-library" element={<Guard><DailySalesV2Library /></Guard>} />
                  <Route path={ROUTES.SHOPPING_LIST} element={<Guard><ShoppingListPage /></Guard>} />
                  
                  {/* ---- FORM 1: canonical + aliases ---- */}
                  <Route path="/operations/daily-sales" element={<DailySalesForm />} />
                  <Route path="/daily-sales" element={<Navigate to="/operations/daily-sales" replace />} />
                  <Route path="/operations/daily-sales-stock" element={<Navigate to="/operations/daily-sales" replace />} />

                  {/* ---- FORM 2: canonical + aliases ---- */}
                  <Route path="/operations/daily-stock" element={<Guard><DailyStock /></Guard>} />
                  {/* Comment out duplicates to avoid conflicts */}
                  {/* <Route path="/operations/stock" element={<Guard><DailyStock /></Guard>} /> */}
                  {/* <Route path="/operations/form2" element={<Navigate to="/operations/stock" replace />} /> */}
                  
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
                  <Route path={ROUTES.EXPENSES} element={<Guard><Expenses /></Guard>} />
                  <Route path="/expenses" element={<Navigate to="/operations/expenses" replace />} />
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
          <Toaster />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
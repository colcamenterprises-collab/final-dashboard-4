import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";
import PinLoginGate, { usePinAuth } from "./components/PinLoginGate";
import PageShell from "./layouts/PageShell";
import Home from "./pages/Home";
import Login from "./pages/auth/Login";
import NotFound from "./pages/NotFound";

import DailySalesForm from "./pages/operations/daily-sales/Form";
import DailyStock from "./pages/operations/DailyStock";
import DailySalesV2Library from "./pages/operations/daily-sales-v2/Library";
import PurchasingPage from "./pages/operations/Purchasing";
import ShoppingList from "./pages/operations/ShoppingList";
import IssueRegister from "./pages/operations/IssueRegister";
import ManagerChecklist from "./pages/operations/ManagerChecklist";
import HealthSafety from "./pages/operations/HealthSafety";

import Ingredients from "./pages/menu/Ingredients";
import MenuItems from "./pages/menu/MenuItems";
import CostCalculator from "./pages/menu/CostCalculator";

import FinanceHub from "./pages/finance/FinanceHub";
import ProfitLoss from "./pages/finance/ProfitLoss";
import Expenses from "./pages/finance/Expenses";

import ShiftReports from "./pages/reports/ShiftReports";

import Orders from "./pages/ordering/Orders";
import Catalog from "./pages/ordering/Catalog";

function OwnerRoute({ children }: { children: JSX.Element }) {
  const { currentUser } = usePinAuth();
  if (currentUser?.role !== "owner") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <BrowserRouter>
              <PinLoginGate>
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/login" element={<Login />} />
                  <Route element={<PageShell />}>
                    {/* Core */}
                    <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales/edit/:id" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />
                    <Route path="/operations/daily-stock" element={<ProtectedRoute><DailyStock /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales-v2/library" element={<ProtectedRoute><OwnerRoute><DailySalesV2Library /></OwnerRoute></ProtectedRoute>} />
                    <Route path="/operations/daily-sales-library" element={<Navigate to="/operations/daily-sales-v2/library" replace />} />
                    <Route path="/operations/purchasing" element={<ProtectedRoute><PurchasingPage /></ProtectedRoute>} />

                    {/* Operations Tools */}
                    <Route path="/operations/shopping-list" element={<ProtectedRoute><ShoppingList /></ProtectedRoute>} />
                    <Route path="/operations/issue-register" element={<ProtectedRoute><IssueRegister /></ProtectedRoute>} />
                    <Route path="/operations/manager-checklist" element={<ProtectedRoute><ManagerChecklist /></ProtectedRoute>} />
                    <Route path="/operations/health-safety" element={<ProtectedRoute><HealthSafety /></ProtectedRoute>} />

                    {/* Menu */}
                    <Route path="/menu/ingredients" element={<ProtectedRoute><Ingredients /></ProtectedRoute>} />
                    <Route path="/menu/items" element={<ProtectedRoute><MenuItems /></ProtectedRoute>} />
                    <Route path="/menu/cost-calculator" element={<ProtectedRoute><CostCalculator /></ProtectedRoute>} />

                    {/* Finance */}
                    <Route path="/finance" element={<ProtectedRoute><FinanceHub /></ProtectedRoute>} />
                    <Route path="/finance/profit-loss" element={<ProtectedRoute><ProfitLoss /></ProtectedRoute>} />
                    <Route path="/finance/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />

                    {/* Reports */}
                    <Route path="/reports/shift-reports" element={<ProtectedRoute><ShiftReports /></ProtectedRoute>} />

                    {/* Online Ordering */}
                    <Route path="/ordering/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                    <Route path="/ordering/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />

                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
                <Toaster />
              </PinLoginGate>
            </BrowserRouter>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

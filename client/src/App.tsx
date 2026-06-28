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
import { StaffEntry } from "./pages/PublicWebsite";
import { SBBHome, SBBMenu, SBBMembership } from "./pages/public/SBBHome";
import NotFound from "./pages/NotFound";

import DailySalesForm from "./pages/operations/daily-sales/Form";
import DailyCleaning from "./pages/operations/DailyCleaning";
import DailyStock from "./pages/operations/DailyStock";
import DailySalesV2Library from "./pages/operations/daily-sales-v2/Library";
import LoyverseMirror from "./pages/operations/LoyverseMirror";
import DailySalesAnalysis from "./pages/operations/DailySalesAnalysis";
import DailyStockAnalysis from "./pages/operations/DailyStockAnalysis";
import PurchasingPage from "./pages/operations/Purchasing";
import PurchaseLodgement from "./pages/operations/PurchaseLodgement";
import ShoppingList from "./pages/operations/ShoppingList";
import IssueRegister from "./pages/operations/IssueRegister";
import ManagerChecklist from "./pages/operations/ManagerChecklist";
import HealthSafety from "./pages/operations/HealthSafety";

import MenuWorkspace from "./pages/menu/MenuWorkspace";

import FinanceHub from "./pages/finance/FinanceHub";
import ProfitLoss from "./pages/finance/ProfitLoss";
import Expenses from "./pages/finance/Expenses";
import ExpensesImport from "./pages/finance/ExpensesImport";

import ShiftReports from "./pages/reports/ShiftReports";
import ShiftHistory from "./pages/reports/ShiftHistory";
import Export from "./pages/reports/Export";
import ReceiptAnalytics from "./pages/reports/ReceiptAnalytics";

import Orders from "./pages/ordering/Orders";
import Catalog from "./pages/ordering/Catalog";
import OnlineOrdering from "./pages/ordering/OnlineOrdering";
import Checkout from "./pages/ordering/Checkout";
import Confirmation from "./pages/ordering/Confirmation";
import OrderPage from "./pages/ordering/OrderPage";
import OrderStatus from "./pages/ordering/OrderStatus";
import KitchenDisplay from "./pages/kitchen/KitchenDisplay";
import AdminMenu from "./pages/admin/ordering/AdminMenu";
import AdminOrders from "./pages/admin/ordering/AdminOrders";
import AdminSettings from "./pages/admin/ordering/AdminSettings";
import AdminQrCodes from "./pages/admin/ordering/AdminQrCodes";

import StaffDashboard from "./pages/staff/Dashboard";
import StaffMembers from "./pages/staff/Members";
import StaffRoster from "./pages/staff/Roster";
import StaffCleaning from "./pages/staff/Cleaning";
import StaffAttendance from "./pages/staff/Attendance";
import StaffSettings from "./pages/staff/Settings";

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
                  <Route path="/" element={<SBBHome />} />
                  <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/menu" element={<SBBMenu />} />
                  <Route path="/membership" element={<SBBMembership />} />
                  <Route path="/staff" element={<StaffEntry />} />
                  <Route path="/operations/loyverse-mirror" element={<ProtectedRoute><OwnerRoute><LoyverseMirror /></OwnerRoute></ProtectedRoute>} />
                  <Route path="/order" element={<OrderPage />} />
                  <Route path="/order/:venueCode" element={<OrderPage />} />
                  <Route path="/order/table/:tableCode" element={<OrderPage />} />
                  <Route path="/order/status/:orderId" element={<OrderStatus />} />
                  <Route path="/ordering/tablet" element={<OrderPage tablet />} />
                  <Route path="/kitchen/display" element={<KitchenDisplay />} />
                  <Route element={<PageShell />}>
                    {/* Core */}
                    <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales/edit/:id" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />
                    <Route path="/operations/daily-cleaning" element={<ProtectedRoute><DailyCleaning /></ProtectedRoute>} />
                    <Route path="/operations/daily-stock" element={<ProtectedRoute><DailyStock /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales-v2/library" element={<ProtectedRoute><OwnerRoute><DailySalesV2Library /></OwnerRoute></ProtectedRoute>} />
                    <Route path="/operations/daily-sales-analysis" element={<ProtectedRoute><DailySalesAnalysis /></ProtectedRoute>} />
                    <Route path="/operations/daily-stock-analysis" element={<ProtectedRoute><DailyStockAnalysis /></ProtectedRoute>} />
                    <Route path="/operations/daily-sales-library" element={<Navigate to="/operations/daily-sales-v2/library" replace />} />
                    <Route path="/operations/purchasing" element={<ProtectedRoute><PurchasingPage /></ProtectedRoute>} />
                    <Route path="/operations/purchase-lodgement" element={<ProtectedRoute><PurchaseLodgement /></ProtectedRoute>} />

                    {/* Operations Tools */}
                    <Route path="/operations/shopping-list" element={<ProtectedRoute><ShoppingList /></ProtectedRoute>} />
                    <Route path="/operations/issue-register" element={<ProtectedRoute><IssueRegister /></ProtectedRoute>} />
                    <Route path="/operations/manager-checklist" element={<ProtectedRoute><ManagerChecklist /></ProtectedRoute>} />
                    <Route path="/operations/health-safety" element={<ProtectedRoute><HealthSafety /></ProtectedRoute>} />

                    {/* Menu */}
                    <Route path="/menu/items" element={<ProtectedRoute><MenuWorkspace /></ProtectedRoute>} />
                    <Route path="/menu/recipes" element={<ProtectedRoute><MenuWorkspace /></ProtectedRoute>} />
                    <Route path="/menu/recipes/new" element={<ProtectedRoute><MenuWorkspace /></ProtectedRoute>} />
                    <Route path="/menu/recipes/:recipeId/edit" element={<ProtectedRoute><MenuWorkspace /></ProtectedRoute>} />
                    <Route path="/menu/modifiers" element={<ProtectedRoute><MenuWorkspace /></ProtectedRoute>} />
                    <Route path="/menu/categories" element={<ProtectedRoute><MenuWorkspace /></ProtectedRoute>} />
                    <Route path="/menu/ingredients" element={<ProtectedRoute><MenuWorkspace /></ProtectedRoute>} />
                    <Route path="/menu/cost-calculator" element={<ProtectedRoute><Navigate to="/menu/recipes" replace /></ProtectedRoute>} />

                    {/* Finance */}
                    <Route path="/finance" element={<ProtectedRoute><FinanceHub /></ProtectedRoute>} />
                    <Route path="/finance/profit-loss" element={<ProtectedRoute><ProfitLoss /></ProtectedRoute>} />
                    <Route path="/finance/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
                    <Route path="/finance/expenses-import" element={<ProtectedRoute><ExpensesImport /></ProtectedRoute>} />

                    {/* Reports */}
                    <Route path="/reports/shift-reports" element={<ProtectedRoute><ShiftReports /></ProtectedRoute>} />
                    <Route path="/reports/shift-history" element={<ProtectedRoute><ShiftHistory /></ProtectedRoute>} />
                    <Route path="/reports/export" element={<ProtectedRoute><Export /></ProtectedRoute>} />
                    <Route path="/reports/receipts-analysis" element={<ProtectedRoute><ReceiptAnalytics /></ProtectedRoute>} />

                    {/* Online Ordering (customer-facing) */}
                    <Route path="/online-ordering" element={<OnlineOrdering />} />
                    <Route path="/online-ordering/checkout" element={<Checkout />} />
                    <Route path="/online-ordering/confirmation" element={<Confirmation />} />

                    {/* Admin Ordering */}
                    <Route path="/ordering/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                    <Route path="/ordering/catalog" element={<ProtectedRoute><Catalog /></ProtectedRoute>} />
                    <Route path="/kitchen/orders" element={<ProtectedRoute><KitchenDisplay /></ProtectedRoute>} />
                    <Route path="/admin/ordering/menu" element={<ProtectedRoute><AdminMenu /></ProtectedRoute>} />
                    <Route path="/admin/ordering/orders" element={<ProtectedRoute><AdminOrders /></ProtectedRoute>} />
                    <Route path="/admin/ordering/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
                    <Route path="/admin/ordering/qr-codes" element={<ProtectedRoute><AdminQrCodes /></ProtectedRoute>} />

                    {/* Staff Operations */}
                    <Route path="/staff/dashboard" element={<ProtectedRoute><StaffDashboard /></ProtectedRoute>} />
                    <Route path="/staff/members" element={<ProtectedRoute><StaffMembers /></ProtectedRoute>} />
                    <Route path="/staff/roster" element={<ProtectedRoute><StaffRoster /></ProtectedRoute>} />
                    <Route path="/staff/cleaning" element={<ProtectedRoute><StaffCleaning /></ProtectedRoute>} />
                    <Route path="/staff/attendance" element={<ProtectedRoute><StaffAttendance /></ProtectedRoute>} />
                    <Route path="/staff/settings" element={<ProtectedRoute><StaffSettings /></ProtectedRoute>} />

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

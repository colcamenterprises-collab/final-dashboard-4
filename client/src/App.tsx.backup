import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "./components/ErrorBoundary";
import PageShell from "./layouts/PageShell";
import NotFound from "./pages/NotFound";

import Home from "./pages/Home";
import { Analysis } from "./pages/operations/Analysis";
import DailySalesV2Library from "./pages/operations/daily-sales-v2/Library";
import ShoppingList from "./pages/ShoppingList";
import PurchasingList from "./pages/operations/PurchasingList";
import PurchasingFieldMapping from "./pages/operations/PurchasingFieldMapping";
import PurchasingShiftLog from "./pages/operations/PurchasingShiftLog";
import Receipts from "./pages/Receipts";
import UploadStatements from "./pages/UploadStatements";
import ProfitLoss from "./pages/ProfitLoss";
import FinancePage from "./pages/finance/FinancePage";
import CostCalculator from "./pages/CostCalculator";
import Ingredients from "./pages/Ingredients";
import Expenses from "./pages/Expenses";
import ExpensesImport from "./pages/finance/ExpensesImport";
import ExpensesV2 from "./pages/expenses/ExpensesV2";
import MenuManager from "./pages/menu/MenuManager";
import MenuImport from "./pages/menu/MenuImport";
import DescriptionTool from "./pages/menu/DescriptionTool";
import IngredientEdit from "./pages/menu/IngredientEdit";
import RecipesUnified from "./pages/menu/Recipes";
import RecipeCards from "./pages/menu/RecipeCards";
import IngredientManagement from "./pages/menu/IngredientManagement";
import ShiftReports from "./pages/ShiftReports";
import NightlyChecklist from "./pages/NightlyChecklist";
import JussiOps from "./pages/JussiOps";
import JaneAccounts from "./pages/JaneAccounts";
import DailySalesForm from "./pages/operations/daily-sales/Form";
import DailyStock from "./pages/operations/DailyStock";
import { LoyverseReports } from "./pages/operations/LoyverseReports";
import PurchasingPage from "./pages/operations/Purchasing";
import StockReview from "./pages/analysis/StockReview";
import ShiftAnalyticsMM from "./pages/analysis/ShiftAnalyticsMM";
import DailyReview from "./pages/analysis/DailyReview";
import OnlineOrdering from "./pages/OnlineOrdering";
import MenuAdmin from "./pages/marketing/MenuAdmin";
import PurchasingLive from "./pages/ops/PurchasingLive";
import MemberDashboard from "./pages/membership/MemberDashboard";
import MemberRegistration from "./pages/membership/MemberRegistration";
import DailySummaryReportsPage from "./pages/operations/daily-reports";
import SystemHealthPage from "./pages/operations/system-health";
import ShiftReportDashboard from "./pages/reports/shift-report";
import ShiftReportHistory from "./pages/reports/shift-report/history";
import ShiftReportDetail from "./pages/reports/shift-report/view/ShiftReportDetail";
import Checkout from "./pages/ordering/Checkout";
import OrderConfirmation from "./pages/ordering/OrderConfirmation";
import AdminOrders from "./pages/ordering/AdminOrders";
import LoyverseMappingConsole from "./pages/loyverse/LoyverseMappingConsole";
import PartnerBars from "./pages/partners/PartnerBars";
import PartnerAnalytics from "./pages/partners/PartnerAnalytics";
import DeliveryAdmin from "./pages/delivery/DeliveryAdmin";
import DriverManager from "./pages/delivery/DriverManager";
import DeliveryHistory from "./pages/delivery/DeliveryHistory";
import KDS from "./pages/kds/KDS";
import KDSHistory from "./pages/kds/KDSHistory";
import MenuAdminV3 from "./pages/menuV3/MenuAdmin";
import POSLogin from "./pages/pos/POSLogin";
import POS from "./pages/pos/POS";
import POSRegisterStatus from "./pages/pos/POSRegisterStatus";
import POSCheckout from "./pages/pos/POSCheckout";
import POSReceiptPreview from "./pages/pos/POSReceiptPreview";
import LiveStock from "./pages/stock/LiveStock";
import IngredientUsage from "./pages/analysis/IngredientUsage";
import StockVariance from "./pages/analysis/StockVariance";
import SaaSAdmin from "./pages/saas/SaaSAdmin";
import Login from "./pages/auth/Login";
import TenantSwitcher from "./pages/settings/TenantSwitcher";
import PaymentProviders from "./pages/settings/PaymentProviders";
import DataSafety from "./pages/admin/DataSafety";

import { isAllowedPath, ROUTES } from "./router/RouteRegistry";

function Guard({ children }: { children: JSX.Element }) {
  const { pathname } = useLocation();
  return isAllowedPath(pathname) ? children : <NotFound />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path={ROUTES.ORDER} element={<OnlineOrdering />} />
              <Route path={ROUTES.ORDER_CHECKOUT} element={<Checkout />} />
              <Route path={ROUTES.ORDER_CONFIRMATION} element={<OrderConfirmation />} />

              <Route element={<PageShell />}>
                <Route path={ROUTES.HOME} element={<Guard><Home /></Guard>} />

                <Route path={ROUTES.DAILY_SALES_LIBRARY} element={<Guard><DailySalesV2Library /></Guard>} />
                <Route path="/operations/daily-sales-library" element={<Guard><DailySalesV2Library /></Guard>} />
                <Route path={ROUTES.SHOPPING_LIST} element={<Guard><ShoppingList /></Guard>} />
                <Route path="/operations/purchasing-list/:id" element={<Guard><PurchasingList /></Guard>} />
                <Route path="/operations/purchasing-mapping" element={<Guard><PurchasingFieldMapping /></Guard>} />
                <Route path="/operations/purchasing-shift-log" element={<Guard><PurchasingShiftLog /></Guard>} />
                
                <Route path="/operations/daily-sales" element={<DailySalesForm />} />
                <Route path="/operations/daily-sales/edit/:id" element={<DailySalesForm />} />
                <Route path="/daily-sales" element={<Navigate to="/operations/daily-sales" replace />} />
                <Route path="/operations/daily-sales-stock" element={<Navigate to="/operations/daily-sales" replace />} />

                <Route path="/operations/daily-stock" element={<Guard><DailyStock /></Guard>} />
                
                <Route path="/ops/purchasing-live" element={<Guard><PurchasingLive /></Guard>} />
                <Route path="/operations/purchasing" element={<Guard><PurchasingPage /></Guard>} />
                
                <Route path="/operations/daily-reports" element={<Guard><DailySummaryReportsPage /></Guard>} />
                <Route path="/operations/system-health" element={<Guard><SystemHealthPage /></Guard>} />
                
                <Route path="/operations/analysis" element={<Guard><Analysis /></Guard>}>
                  <Route index element={null} />
                  <Route path="loyverse" element={<LoyverseReports />} />
                  <Route path="stock-review" element={<Guard><StockReview /></Guard>} />
                  <Route path="shift-items" element={<Guard><ShiftAnalyticsMM /></Guard>} />
                </Route>
                
                <Route path="upload" element={<UploadStatements />} />
                <Route path="receipts" element={<Receipts />} />
                
                <Route path={ROUTES.UPLOAD_STATEMENTS} element={<Guard><UploadStatements /></Guard>} />
                <Route path={ROUTES.RECEIPTS} element={<Guard><Receipts /></Guard>} />
                <Route path={ROUTES.RECEIPTS_BURGERS} element={<Navigate to={ROUTES.SHIFT_ITEMS_MM} replace />} />
                <Route path="/receipts-burger-counts" element={<Navigate to={ROUTES.SHIFT_ITEMS_MM} replace />} />
                <Route path={ROUTES.EXPENSES} element={<Guard><Expenses /></Guard>} />
                <Route path="/expenses" element={<Navigate to="/operations/expenses" replace />} />
                <Route path={ROUTES.SHIFT_REPORTS} element={<Guard><ShiftReports /></Guard>} />

                <Route path="/reports/shift-report" element={<Guard><ShiftReportDashboard /></Guard>} />
                <Route path="/reports/shift-report/history" element={<Guard><ShiftReportHistory /></Guard>} />
                <Route path="/reports/shift-report/view/:id" element={<Guard><ShiftReportDetail /></Guard>} />

                <Route path={ROUTES.FINANCE} element={<Guard><FinancePage /></Guard>} />
                <Route path={ROUTES.PROFIT_LOSS} element={<Guard><ProfitLoss /></Guard>} />
                <Route path="/finance/expenses" element={<Guard><Expenses /></Guard>} />
                <Route path={ROUTES.EXPENSES_IMPORT} element={<Guard><ExpensesImport /></Guard>} />
                <Route path={ROUTES.EXPENSES_V2} element={<Guard><ExpensesV2 /></Guard>} />

                <Route path={ROUTES.COST_CALCULATOR} element={<Guard><CostCalculator /></Guard>} />
                <Route path={ROUTES.INGREDIENTS} element={<Guard><Ingredients /></Guard>} />
                <Route path="/menu/ingredients/edit/:id" element={<Guard><IngredientEdit /></Guard>} />
                <Route path={ROUTES.MENU_MGR} element={<Guard><MenuManager /></Guard>} />
                <Route path={ROUTES.MENU_IMPORT} element={<Guard><MenuImport /></Guard>} />
                <Route path={ROUTES.MENU_DESC_TOOL} element={<Guard><DescriptionTool /></Guard>} />
                <Route path={ROUTES.RECIPES} element={<Guard><RecipesUnified /></Guard>} />
                <Route path={ROUTES.RECIPE_CARDS} element={<Guard><RecipeCards /></Guard>} />
                <Route path={ROUTES.INGREDIENT_MANAGEMENT} element={<Guard><IngredientManagement /></Guard>} />

                <Route path={ROUTES.NIGHTLY_CHECKLIST} element={<Guard><NightlyChecklist /></Guard>} />
                <Route path={ROUTES.JUSSI_AI} element={<Guard><JussiOps /></Guard>} />
                <Route path={ROUTES.JANE_ACCOUNTS} element={<Guard><JaneAccounts /></Guard>} />

                <Route path={ROUTES.ONLINE_ORDERING} element={<Guard><OnlineOrdering /></Guard>} />
                <Route path={ROUTES.MENU_ADMIN} element={<Guard><MenuAdmin /></Guard>} />
                <Route path={ROUTES.ADMIN_ORDERS} element={<Guard><AdminOrders /></Guard>} />
                <Route path="/admin/loyverse-mapping" element={<Guard><LoyverseMappingConsole /></Guard>} />
                <Route path="/admin/data-safety" element={<Guard><DataSafety /></Guard>} />

                <Route path="/partners" element={<Guard><PartnerBars /></Guard>} />
                <Route path="/partners/analytics" element={<Guard><PartnerAnalytics /></Guard>} />

                <Route path="/delivery/admin" element={<Guard><DeliveryAdmin /></Guard>} />
                <Route path="/delivery/drivers" element={<Guard><DriverManager /></Guard>} />
                <Route path="/delivery/history" element={<Guard><DeliveryHistory /></Guard>} />

                <Route path="/kds" element={<KDS />} />
                <Route path="/kds/history" element={<KDSHistory />} />

                <Route path="/menu-v3" element={<MenuAdminV3 />} />

                <Route path="/pos-login" element={<POSLogin />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/pos-register" element={<POSRegisterStatus />} />
                <Route path="/pos-checkout" element={<POSCheckout />} />
                <Route path="/pos-receipt" element={<POSReceiptPreview />} />

                <Route path="/stock-live" element={<LiveStock />} />

                <Route path="/analysis/ingredients-usage" element={<IngredientUsage />} />
                <Route path="/analysis/stock-variance" element={<StockVariance />} />

                <Route path="/saas" element={<SaaSAdmin />} />
                <Route path="/settings/tenant" element={<TenantSwitcher />} />
                <Route path="/settings/payments" element={<PaymentProviders />} />

                <Route path="/membership" element={<Navigate to="/membership/dashboard" replace />} />
                <Route path="/membership/dashboard" element={<Guard><MemberDashboard /></Guard>} />
                <Route path="/membership/register" element={<Guard><MemberRegistration /></Guard>} />

                <Route path="/analysis/daily-review" element={<DailyReview />} />

                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
            <Toaster />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

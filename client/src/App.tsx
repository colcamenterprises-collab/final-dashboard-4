/**
 * 🔒 NAVIGATION LOCK — APPROVED STRUCTURE
 * Date: Jan 28, 2026
 *
 * Sidebar sections are FINAL:
 * - Operations
 * - Purchasing
 * - Analysis
 * - Finance
 * - Menu Management
 *
 * Do NOT:
 * - Move Ingredient Authority out of Menu Management
 * - Add new root sections
 *
 * All navigation changes require explicit owner approval.
 */
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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
import PurchasingAnalytics from "./pages/operations/PurchasingAnalytics";
import Receipts from "./pages/Receipts";
import UploadStatements from "./pages/UploadStatements";
import ProfitLoss from "./pages/ProfitLoss";
import FinancePage from "./pages/finance/FinancePage";
import CostCalculator from "./pages/CostCalculator";
import Ingredients from "./pages/Ingredients";
import Expenses from "./pages/Expenses";
import ExpensesImport from "./pages/finance/ExpensesImport";
import ExpensesV2 from "./pages/expenses/ExpensesV2";
import MenuManagement from "./pages/menu/MenuManagement";
import MenuImport from "./pages/menu/MenuImport";
import DescriptionTool from "./pages/menu/DescriptionTool";
import IngredientEdit from "./pages/menu/IngredientEdit";
import RecipeCards from "./pages/menu/RecipeCards";
import RecipeEditorPage from "./pages/menu/RecipeEditor";
import RecipeListPage from "./pages/menu/Recipes";
import IngredientManagement from "./pages/menu/IngredientManagement";
import Products from "./pages/Products";
import ProductPage from "./pages/ProductPage";
import ShiftReports from "./pages/ShiftReports";
import NightlyChecklist from "./pages/NightlyChecklist";
import JussiOps from "./pages/JussiOps";
import JaneAccounts from "./pages/JaneAccounts";
import DailySalesForm from "./pages/operations/daily-sales/Form";
import DailyStock from "./pages/operations/DailyStock";
import { LoyverseReports } from "./pages/operations/LoyverseReports";
import PurchasingPage from "./pages/operations/Purchasing";
import StockReview from "./pages/analysis/StockReview";
import StockReconciliation from "./pages/analysis/StockReconciliation";
import OwnerStockControl from "./pages/analysis/OwnerStockControl";
import ShiftAnalyticsMM from "./pages/analysis/ShiftAnalyticsMM";
import DailyShiftAnalysis from "./pages/operations/DailyShiftAnalysis";
import AnalysisPrototype from "./pages/AnalysisPrototype";
import OnlineOrdering from "./pages/OnlineOrdering";
import MenuAdmin from "./pages/marketing/MenuAdmin";
import OnlineOrderingCatalogPage from "./pages/online-ordering/CatalogPage";
import MarketingMachine from "./pages/marketing/MarketingMachine";
import PurchasingLive from "./pages/ops/PurchasingLive";
import IngredientPurchasingList from "./pages/ops/IngredientPurchasingList";
import IngredientPurchasingForm from "./pages/ops/IngredientPurchasingForm";
import MemberDashboard from "./pages/membership/MemberDashboard";
import MemberRegistration from "./pages/membership/MemberRegistration";
import DailySummaryReportsPage from "./pages/operations/daily-reports";
import SystemHealthPage from "./pages/operations/system-health";
import AiOpsControlPage from "./pages/operations/AiOpsControl";
import TaskDetailPage from "./pages/operations/tasks/TaskDetail";
import VarianceMonitorPage from "./pages/operations/VarianceMonitor";
import IssueRegisterPage from "./pages/operations/IssueRegister";
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
import CustomerDisplayPage from "./pages/pos/CustomerDisplayPage";
import LiveStock from "./pages/stock/LiveStock";
import IngredientUsage from "./pages/analysis/IngredientUsage";
import StockVariance from "./pages/analysis/StockVariance";
import ReceiptsTruth from "./pages/analysis/ReceiptsTruth";
import IngredientsTruth from "./pages/analysis/IngredientsTruth";
import GrabLoyverseMonthlyReconciliation from "./pages/analysis/GrabLoyverseMonthlyReconciliation";
import SaaSAdmin from "./pages/saas/SaaSAdmin";
import Login from "./pages/auth/Login";
import TenantSwitcher from "./pages/settings/TenantSwitcher";
import PaymentProviders from "./pages/settings/PaymentProviders";
import DataSafety from "./pages/admin/DataSafety";
import IngredientsMaster from "./pages/operations/IngredientsMaster";
import PurchaseHistory from "./pages/operations/PurchaseHistory";
import HealthSafetyAuditPage from "./pages/operations/health-safety-audit";
import HealthSafetyQuestionManager from "./pages/operations/health-safety-audit/questions";
import RecipeMappingPage from "./pages/operations/recipe-mapping";
import { AuthProvider } from "./auth/AuthProvider";
import ProtectedRoute from "./auth/ProtectedRoute";
import PinLoginGate from "./components/PinLoginGate";
import StaffAccessPage from "./pages/settings/StaffAccess";
import UserProfile from "./pages/settings/UserProfile";

import HomePage from "./pages/public/HomePage";
import PublicMembership from "./pages/public/PublicMembership";
import PublicOnlineOrdering from "./pages/public/PublicOnlineOrdering";

import { ROUTES } from "./router/RouteRegistry";

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
        <TooltipProvider>
          <BrowserRouter>
            <PinLoginGate>
            <Routes>
              {/* Root — redirect to app dashboard */}
              <Route path="/" element={<Navigate to="/dashboard" replace />} />

              {/* Public website routes — no sidebar/shell */}
              <Route path="/website" element={<HomePage />} />
              <Route path="/website/membership" element={<PublicMembership />} />
              <Route path="/website/online-ordering" element={<PublicOnlineOrdering />} />
              <Route path="/login" element={<Login />} />
              <Route path={ROUTES.ORDER} element={<OnlineOrdering />} />
              <Route path={ROUTES.ORDER_CHECKOUT} element={<Checkout />} />
              <Route path={ROUTES.ORDER_CONFIRMATION} element={<OrderConfirmation />} />

              <Route element={<PageShell />}>
                <Route path="/dashboard" element={<ProtectedRoute><Home /></ProtectedRoute>} />
                <Route path="/home" element={<Navigate to="/dashboard" replace />} />

                <Route path={ROUTES.DAILY_SALES_LIBRARY} element={<ProtectedRoute><DailySalesV2Library /></ProtectedRoute>} />
                <Route path="/operations/daily-sales-library" element={<ProtectedRoute><DailySalesV2Library /></ProtectedRoute>} />
                <Route path={ROUTES.SHOPPING_LIST} element={<ProtectedRoute><ShoppingList /></ProtectedRoute>} />
                <Route path="/operations/purchasing-list/:id" element={<ProtectedRoute><PurchasingList /></ProtectedRoute>} />
                <Route path="/operations/purchasing-mapping" element={<ProtectedRoute><PurchasingFieldMapping /></ProtectedRoute>} />
                <Route path="/operations/purchasing-shift-log" element={<ProtectedRoute><PurchasingShiftLog /></ProtectedRoute>} />
                <Route path="/operations/purchasing-analytics" element={<ProtectedRoute><PurchasingAnalytics /></ProtectedRoute>} />
                <Route path={ROUTES.INGREDIENT_PURCHASING} element={<ProtectedRoute><IngredientPurchasingList /></ProtectedRoute>} />
                <Route path="/operations/ingredient-purchasing/new" element={<ProtectedRoute><IngredientPurchasingForm /></ProtectedRoute>} />
                <Route path="/operations/ingredient-purchasing/:id" element={<ProtectedRoute><IngredientPurchasingForm /></ProtectedRoute>} />
                {/* PATCH S1: Disabled - stock logging moved to Shopping List modal */}
                
                <Route path="/operations/daily-sales" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />
                <Route path="/operations/daily-sales/edit/:id" element={<ProtectedRoute><DailySalesForm /></ProtectedRoute>} />
                <Route path="/daily-sales" element={<Navigate to="/operations/daily-sales" replace />} />
                <Route path="/operations/daily-sales-stock" element={<Navigate to="/operations/daily-sales" replace />} />

                <Route path="/operations/daily-stock" element={<ProtectedRoute><DailyStock /></ProtectedRoute>} />
                
                <Route path="/ops/purchasing-live" element={<ProtectedRoute><PurchasingLive /></ProtectedRoute>} />
                <Route path="/operations/purchasing" element={<ProtectedRoute><PurchasingPage /></ProtectedRoute>} />
                
                <Route path="/operations/daily-reports" element={<ProtectedRoute><DailySummaryReportsPage /></ProtectedRoute>} />
                <Route path="/operations/system-health" element={<ProtectedRoute><SystemHealthPage /></ProtectedRoute>} />
                <Route path="/operations/ai-ops-control" element={<ProtectedRoute><AiOpsControlPage /></ProtectedRoute>} />
                <Route path="/operations/tasks/:id" element={<ProtectedRoute><TaskDetailPage /></ProtectedRoute>} />
                <Route path="/operations/purchase-history" element={<ProtectedRoute><PurchaseHistory /></ProtectedRoute>} />
                <Route path="/operations/health-safety-audit" element={<ProtectedRoute><HealthSafetyAuditPage /></ProtectedRoute>} />
                <Route path="/operations/health-safety-audit/questions" element={<ProtectedRoute><HealthSafetyQuestionManager /></ProtectedRoute>} />
                <Route path="/operations/ingredients-master" element={<ProtectedRoute><IngredientsMaster /></ProtectedRoute>} />
                <Route path="/operations/recipe-mapping" element={<ProtectedRoute><RecipeMappingPage /></ProtectedRoute>} />
                <Route path="/operations/variance-monitor" element={<ProtectedRoute><VarianceMonitorPage /></ProtectedRoute>} />
                <Route path="/operations/issue-register" element={<ProtectedRoute><IssueRegisterPage /></ProtectedRoute>} />
                
                <Route path="/operations/analysis" element={<ProtectedRoute><Analysis /></ProtectedRoute>}>
                  <Route index element={null} />
                  <Route path="loyverse" element={<LoyverseReports />} />
                  <Route path="stock-review" element={<ProtectedRoute><StockReview /></ProtectedRoute>} />
                  <Route path="shift-items" element={<ProtectedRoute><ShiftAnalyticsMM /></ProtectedRoute>} />
                  <Route path="daily-shift-analysis" element={<Navigate to="/analysis/daily-review" replace />} />
                </Route>

                <Route path="/operations/analysis/stock-review" element={<Navigate to="/analysis/stock-review" replace />} />
                <Route path="/analysis/stock-review" element={<ProtectedRoute><StockReview /></ProtectedRoute>} />
                <Route path="/analysis/stock-reconciliation" element={<ProtectedRoute><StockReconciliation /></ProtectedRoute>} />
                <Route path="/analysis/owner-stock-control" element={<ProtectedRoute><OwnerStockControl /></ProtectedRoute>} />
                <Route path="/operations/analysis/rolls-ledger" element={<Navigate to="/analysis/stock-review" replace />} />
                
                <Route path="upload" element={<ProtectedRoute><UploadStatements /></ProtectedRoute>} />
                <Route path="receipts" element={<ProtectedRoute><Receipts /></ProtectedRoute>} />
                
                <Route path={ROUTES.UPLOAD_STATEMENTS} element={<ProtectedRoute><UploadStatements /></ProtectedRoute>} />
                <Route path={ROUTES.RECEIPTS} element={<ProtectedRoute><Receipts /></ProtectedRoute>} />
                <Route path={ROUTES.RECEIPTS_BURGERS} element={<Navigate to={ROUTES.SHIFT_ITEMS_MM} replace />} />
                <Route path="/receipts-burger-counts" element={<Navigate to={ROUTES.SHIFT_ITEMS_MM} replace />} />
                <Route path={ROUTES.EXPENSES} element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
                <Route path="/expenses" element={<Navigate to="/operations/expenses" replace />} />
                <Route path={ROUTES.SHIFT_REPORTS} element={<ProtectedRoute><ShiftReports /></ProtectedRoute>} />

                <Route path="/reports/shift-report" element={<ProtectedRoute><ShiftReportDashboard /></ProtectedRoute>} />
                <Route path="/reports/shift-report/history" element={<ProtectedRoute><ShiftReportHistory /></ProtectedRoute>} />
                <Route path="/reports/shift-report/view/:id" element={<ProtectedRoute><ShiftReportDetail /></ProtectedRoute>} />

                <Route path={ROUTES.FINANCE} element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
                <Route path={ROUTES.PROFIT_LOSS} element={<ProtectedRoute><ProfitLoss /></ProtectedRoute>} />
                <Route path="/finance/expenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
                <Route path={ROUTES.EXPENSES_IMPORT} element={<ProtectedRoute><ExpensesImport /></ProtectedRoute>} />
                <Route path={ROUTES.EXPENSES_V2} element={<ProtectedRoute><ExpensesV2 /></ProtectedRoute>} />

                <Route path={ROUTES.COST_CALCULATOR} element={<ProtectedRoute><CostCalculator /></ProtectedRoute>} />
                <Route path={ROUTES.INGREDIENTS} element={<ProtectedRoute><Ingredients /></ProtectedRoute>} />
                <Route path="/menu/ingredients/edit/:id" element={<ProtectedRoute><IngredientEdit /></ProtectedRoute>} />
                <Route path={ROUTES.MENU_MGR} element={<Navigate to="/menu/recipes" replace />} />
                <Route path={ROUTES.MENU_IMPORT} element={<ProtectedRoute><MenuImport /></ProtectedRoute>} />
                <Route path={ROUTES.MENU_DESC_TOOL} element={<ProtectedRoute><DescriptionTool /></ProtectedRoute>} />
                <Route path={ROUTES.RECIPE_MANAGEMENT} element={<Navigate to="/menu/recipes" replace />} />
                <Route path={ROUTES.RECIPES} element={<ProtectedRoute><RecipeListPage /></ProtectedRoute>} />
                <Route path={ROUTES.RECIPES_NEW} element={<ProtectedRoute><RecipeEditorPage /></ProtectedRoute>} />
                <Route path={ROUTES.RECIPES_EDIT} element={<ProtectedRoute><RecipeEditorPage /></ProtectedRoute>} />
                <Route path={ROUTES.RECIPE_CARDS} element={<ProtectedRoute><RecipeCards /></ProtectedRoute>} />
                <Route path={ROUTES.INGREDIENT_MANAGEMENT} element={<ProtectedRoute><IngredientManagement /></ProtectedRoute>} />
                <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                <Route path="/products/new" element={<ProtectedRoute><ProductPage /></ProtectedRoute>} />
                <Route path="/products/:id" element={<ProtectedRoute><ProductPage /></ProtectedRoute>} />

                <Route path={ROUTES.NIGHTLY_CHECKLIST} element={<ProtectedRoute><NightlyChecklist /></ProtectedRoute>} />
                <Route path={ROUTES.JUSSI_AI} element={<ProtectedRoute><JussiOps /></ProtectedRoute>} />
                <Route path={ROUTES.JANE_ACCOUNTS} element={<ProtectedRoute><JaneAccounts /></ProtectedRoute>} />

                <Route path={ROUTES.ONLINE_ORDERING} element={<ProtectedRoute><OnlineOrdering /></ProtectedRoute>} />
                <Route path="/online-ordering/catalog" element={<ProtectedRoute><OnlineOrderingCatalogPage /></ProtectedRoute>} />
                <Route path={ROUTES.MENU_ADMIN} element={<ProtectedRoute><MenuAdmin /></ProtectedRoute>} />
                <Route path={ROUTES.ADMIN_ORDERS} element={<ProtectedRoute><AdminOrders /></ProtectedRoute>} />
                <Route path="/admin/loyverse-mapping" element={<ProtectedRoute><LoyverseMappingConsole /></ProtectedRoute>} />
                <Route path="/admin/data-safety" element={<ProtectedRoute><DataSafety /></ProtectedRoute>} />

                <Route path="/partners" element={<ProtectedRoute><PartnerBars /></ProtectedRoute>} />
                <Route path="/partners/analytics" element={<ProtectedRoute><PartnerAnalytics /></ProtectedRoute>} />

                <Route path="/delivery/admin" element={<ProtectedRoute><DeliveryAdmin /></ProtectedRoute>} />
                <Route path="/delivery/drivers" element={<ProtectedRoute><DriverManager /></ProtectedRoute>} />
                <Route path="/delivery/history" element={<ProtectedRoute><DeliveryHistory /></ProtectedRoute>} />

                <Route path="/kds" element={<ProtectedRoute><KDS /></ProtectedRoute>} />
                <Route path="/kds/history" element={<ProtectedRoute><KDSHistory /></ProtectedRoute>} />

                <Route path="/menu-v3" element={<ProtectedRoute><MenuAdminV3 /></ProtectedRoute>} />
                <Route path="/menu-management/ingredients" element={<ProtectedRoute><IngredientManagement /></ProtectedRoute>} />
                <Route path="/menu-management" element={<ProtectedRoute><MenuManagement /></ProtectedRoute>} />

                <Route path="/pos-login" element={<POSLogin />} />
                <Route path="/pos" element={<ProtectedRoute><POS /></ProtectedRoute>} />
                <Route path="/pos-register" element={<ProtectedRoute><POSRegisterStatus /></ProtectedRoute>} />
                <Route path="/pos-checkout" element={<ProtectedRoute><POSCheckout /></ProtectedRoute>} />
                <Route path="/pos-receipt" element={<ProtectedRoute><POSReceiptPreview /></ProtectedRoute>} />
                <Route path="/pos/customer-display" element={<ProtectedRoute><CustomerDisplayPage /></ProtectedRoute>} />

                <Route path="/stock-live" element={<ProtectedRoute><LiveStock /></ProtectedRoute>} />

                <Route path="/analysis/ingredients-usage" element={<ProtectedRoute><IngredientUsage /></ProtectedRoute>} />
                <Route path="/analysis/stock-variance" element={<ProtectedRoute><StockVariance /></ProtectedRoute>} />
                <Route path="/analysis/receipts" element={<ProtectedRoute><ReceiptsTruth /></ProtectedRoute>} />
                <Route path="/analysis/ingredients" element={<ProtectedRoute><IngredientsTruth /></ProtectedRoute>} />
                <Route path="/analysis/grab-loyverse-monthly-reconciliation" element={<ProtectedRoute><GrabLoyverseMonthlyReconciliation /></ProtectedRoute>} />

                <Route path="/saas" element={<ProtectedRoute><SaaSAdmin /></ProtectedRoute>} />
                <Route path="/settings/tenant" element={<ProtectedRoute><TenantSwitcher /></ProtectedRoute>} />
                <Route path="/settings/payments" element={<ProtectedRoute><PaymentProviders /></ProtectedRoute>} />
                <Route path="/settings/staff-access" element={<ProtectedRoute><StaffAccessPage /></ProtectedRoute>} />
                <Route path="/settings/profile" element={<ProtectedRoute><UserProfile /></ProtectedRoute>} />

                <Route path="/membership/dashboard" element={<ProtectedRoute><MemberDashboard /></ProtectedRoute>} />
                <Route path="/membership/register" element={<ProtectedRoute><MemberRegistration /></ProtectedRoute>} />

                <Route path="/analysis/daily-review" element={<ProtectedRoute><DailyShiftAnalysis /></ProtectedRoute>} />
                <Route path="/operations/analysis/daily-shift-analysis" element={<Navigate to="/analysis/daily-review" replace />} />

                <Route path="/marketing" element={<ProtectedRoute><MarketingMachine /></ProtectedRoute>} />

                <Route path="/analysis-prototype" element={<ProtectedRoute><AnalysisPrototype /></ProtectedRoute>} />

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

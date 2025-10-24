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
import { Analysis } from "./pages/operations/Analysis";
// Legacy component moved to archive
import DailySalesV2Library from "./pages/operations/daily-sales-v2/Library";
import ShoppingList from "./pages/ShoppingList";
import Receipts from "./pages/Receipts";
import UploadStatements from "./pages/UploadStatements";
import ProfitLoss from "./pages/ProfitLoss";
import FinancePage from "./pages/finance/FinancePage";
import CostCalculator from "./pages/CostCalculator";
import Ingredients from "./pages/Ingredients";
import Expenses from "./pages/Expenses";
import ExpensesImport from "./pages/finance/ExpensesImport";
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
import DailyShiftAnalysis from "./pages/operations/DailyShiftAnalysis"; // Hidden - can be re-enabled
import DailySalesAnalysis from "./pages/analysis/DailySalesAnalysis";
import StockReview from "./pages/analysis/StockReview";
import ReceiptsBurgerCounts from "./pages/ReceiptsBurgerCounts";
import ShiftAnalyticsMM from "./pages/analysis/ShiftAnalyticsMM";
import DailyReview from "./pages/analysis/DailyReview";
import OnlineOrdering from "./pages/OnlineOrdering";

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
                  

                  {/* Operations */}
                  <Route path={ROUTES.DAILY_SALES_LIBRARY} element={<Guard><DailySalesV2Library /></Guard>} />
                  <Route path="/operations/daily-sales-library" element={<Guard><DailySalesV2Library /></Guard>} />
                  <Route path={ROUTES.SHOPPING_LIST} element={<Guard><ShoppingList /></Guard>} />
                  
                  {/* ---- FORM 1: canonical + aliases ---- */}
                  <Route path="/operations/daily-sales" element={<DailySalesForm />} />
                  <Route path="/operations/daily-sales/edit/:id" element={<DailySalesForm />} />
                  <Route path="/daily-sales" element={<Navigate to="/operations/daily-sales" replace />} />
                  <Route path="/operations/daily-sales-stock" element={<Navigate to="/operations/daily-sales" replace />} />

                  {/* ---- FORM 2: canonical + aliases ---- */}
                  <Route path="/operations/daily-stock" element={<Guard><DailyStock /></Guard>} />
                  {/* Comment out duplicates to avoid conflicts */}
                  {/* <Route path="/operations/stock" element={<Guard><DailyStock /></Guard>} /> */}
                  {/* <Route path="/operations/form2" element={<Navigate to="/operations/stock" replace />} /> */}
                  
                  {/* Analysis with nested routes */}
                  <Route path="/operations/analysis" element={<Guard><Analysis /></Guard>}>
                    <Route index element={null} />
                    <Route path="loyverse" element={<LoyverseReports />} />
                    {/* Hidden - can be re-enabled */}
                    {/* <Route path="daily-shift-analysis" element={<Guard><DailyShiftAnalysis /></Guard>} /> */}
                    <Route path="stock-review" element={<Guard><StockReview /></Guard>} />
                    <Route path="shift-items" element={<Guard><ShiftAnalyticsMM /></Guard>} />
                  </Route>
                  
                  {/* Legacy analysis routes */}
                  <Route path="upload" element={<UploadStatements />} />
                  <Route path="receipts" element={<Receipts />} />
                  
                  {/* Legacy direct routes */}
                  <Route path={ROUTES.UPLOAD_STATEMENTS} element={<Guard><UploadStatements /></Guard>} />
                  <Route path={ROUTES.RECEIPTS} element={<Guard><Receipts /></Guard>} />
                  {/* Redirect old burger counts to new MM v1.0 page */}
                  <Route path={ROUTES.RECEIPTS_BURGERS} element={<Navigate to={ROUTES.SHIFT_ITEMS_MM} replace />} />
                  <Route path="/receipts-burger-counts" element={<Navigate to={ROUTES.SHIFT_ITEMS_MM} replace />} />
                  <Route path={ROUTES.EXPENSES} element={<Guard><Expenses /></Guard>} />
                  <Route path="/expenses" element={<Navigate to="/operations/expenses" replace />} />
                  <Route path={ROUTES.SHIFT_REPORTS} element={<Guard><ShiftReports /></Guard>} />

                  {/* Finance */}
                  <Route path={ROUTES.FINANCE} element={<Guard><FinancePage /></Guard>} />
                  <Route path={ROUTES.PROFIT_LOSS} element={<Guard><ProfitLoss /></Guard>} />
                  <Route path="/finance/expenses" element={<Guard><Expenses /></Guard>} />
                  <Route path={ROUTES.EXPENSES_IMPORT} element={<Guard><ExpensesImport /></Guard>} />

                  {/* Menu Mgmt */}
                  <Route path={ROUTES.COST_CALCULATOR} element={<Guard><CostCalculator /></Guard>} />
                  <Route path={ROUTES.INGREDIENTS} element={<Guard><Ingredients /></Guard>} />
                  <Route path="/menu/ingredients/edit/:id" element={<Guard><IngredientEdit /></Guard>} />
                  <Route path={ROUTES.MENU_MGR} element={<Guard><MenuManager /></Guard>} />
                  <Route path={ROUTES.MENU_IMPORT} element={<Guard><MenuImport /></Guard>} />
                  <Route path={ROUTES.MENU_DESC_TOOL} element={<Guard><DescriptionTool /></Guard>} />
                  <Route path={ROUTES.RECIPES} element={<Guard><RecipesUnified /></Guard>} />
                  <Route path={ROUTES.RECIPE_CARDS} element={<Guard><RecipeCards /></Guard>} />
                  <Route path={ROUTES.INGREDIENT_MANAGEMENT} element={<Guard><IngredientManagement /></Guard>} />

                  {/* Managers */}
                  <Route path={ROUTES.NIGHTLY_CHECKLIST} element={<Guard><NightlyChecklist /></Guard>} />
                  <Route path={ROUTES.JUSSI_AI} element={<Guard><JussiOps /></Guard>} />
                  <Route path={ROUTES.JANE_ACCOUNTS} element={<Guard><JaneAccounts /></Guard>} />

                  {/* Marketing */}
                  <Route path={ROUTES.ONLINE_ORDERING} element={<Guard><OnlineOrdering /></Guard>} />

                  {/* All Analysis Pages */}
                  {/* Hidden - can be re-enabled */}
                  {/* <Route path="/analysis/daily-shift" element={<DailyShiftAnalysis />} /> */}
                  <Route path="/analysis/daily-sales" element={<DailySalesAnalysis />} />
                  <Route path="/analysis/daily-review" element={<DailyReview />} />

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
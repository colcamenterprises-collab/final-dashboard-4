import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Sidebar from "@/components/Sidebar";
import Dashboard from "@/pages/Dashboard";
import DashboardModern from "@/pages/DashboardModern";
import DailyStockForm from "@/pages/DailyStockForm";
import PastForms from "@/pages/PastForms";
import DraftFormsLibrary from "@/pages/DraftFormsLibrary";
import ShoppingList from "@/pages/ShoppingList";
import Finance from "@/pages/Finance";
import ExpensesMerged from "@/pages/ExpensesMerged";
import POSLoyverse from "@/pages/POSLoyverse";

import RecipeIngredientManagement from "@/pages/RecipeIngredientManagement";
import Analysis from "@/pages/Analysis";
import AnalysisList from "@/pages/AnalysisList";
import AnalysisDetail from "@/pages/AnalysisDetail";
import ReportsAnalysis from "@/pages/ReportsAnalysis";
import ShiftAnalytics from "@/pages/ShiftAnalytics";
import WebhookManagement from "@/pages/WebhookManagement";
import Marketing from "@/pages/Marketing";
import Receipts from "@/pages/Receipts";
import Ingredients from "@/pages/Ingredients";
import IngredientsTable from "@/pages/IngredientsTable";
import DailySales from "@/pages/DailySales";
// import DailyStock from "@/pages/DailyStock"; // Removed - file doesn't exist
import DailyStockPage from "@/pages/daily-stock";
import StockLibrary from "@/pages/stock-library";
import Recipes from "@/pages/Recipes";
import Placeholder from "@/pages/Placeholder";
import Purchasing from "@/pages/Purchasing";
import FormView from "@/pages/FormView";
import SupplierManagement from "@/pages/SupplierManagement";
import TestMonthlyStock from "@/pages/TestMonthlyStock";
import DraftForms from "@/pages/DraftForms";
import ShiftComparison from "@/pages/ShiftComparison";
import ShiftReportDetail from "@/pages/ShiftReportDetail";
import FormsLibrary from "@/pages/FormsLibrary";
import FormLibrary from "@/pages/FormLibrary";
import FormLibraryNew from "@/pages/form-library";
import FormDetail from "@/pages/form-detail";
import TestEmailPage from "@/pages/TestEmailPage";
import ExpensesList from "@/pages/expenses/ExpensesList";
import ExpenseEditor from "@/pages/expenses/ExpenseEditor";
import { BusinessExpenses } from "@/pages/expenses/BusinessExpenses";
import { ShiftPurchasing } from "@/pages/expenses/ShiftPurchasing";
import BusinessExpensesSheet from "@/pages/BusinessExpenses";
import SystemStatus from "@/pages/SystemStatus";

import NotFound from "@/pages/not-found";

function App() {
  // App shell: fixed sidebar + flexible content, no margin hacks
  return (
    <div className="min-h-screen bg-[#f5f7f8] flex">
      <Sidebar />
      <main className="flex-1 min-w-0">
        <Switch>
          <Route path="/" component={DashboardModern} />
          <Route path="/dashboard" component={DashboardModern} />
          <Route path="/daily-sales" component={DailySales} />
          <Route path="/daily-stock" component={DailyStockPage} />
          <Route path="/daily-stock-sales" component={DailyStockForm} />
          <Route path="/receipts" component={Receipts} />
          <Route path="/expenses" component={ExpensesMerged} />
          <Route path="/system-status" component={SystemStatus} />
          
          {/* Keep all your existing routes */}
          <Route path="/dashboard-old" component={Dashboard} />
          <Route path="/past-forms" component={PastForms} />
          <Route path="/shopping-list" component={ShoppingList} />
          <Route path="/finance" component={Finance} />
          <Route path="/pos-loyverse" component={POSLoyverse} />
          <Route path="/recipe-management" component={RecipeIngredientManagement} />
          <Route path="/ingredient-management" component={RecipeIngredientManagement} />
          <Route path="/reports-analysis" component={ReportsAnalysis} />
          <Route path="/analysis" component={AnalysisList} />
          <Route path="/analysis/:id" component={AnalysisDetail} />
          <Route path="/shift-analytics" component={ShiftAnalytics} />
          <Route path="/finance/expenses" component={ExpensesList} />
          <Route path="/finance/expenses/new" component={ExpenseEditor} />
          <Route path="/finance/expenses/:id" component={ExpenseEditor} />
          <Route path="/expenses/business" component={BusinessExpensesSheet} />
          <Route path="/expenses/purchasing" component={ShiftPurchasing} />
          <Route path="/system/status" component={SystemStatus} />
          <Route path="/shift-comparison" component={ShiftComparison} />
          <Route path="/analysis/shift-report/:date" component={ShiftReportDetail} />
          <Route path="/marketing" component={Marketing} />
          <Route path="/ingredients" component={Ingredients} />
          <Route path="/ingredients-table" component={IngredientsTable} />
          <Route path="/stock-library" component={StockLibrary} />
          <Route path="/recipes" component={Recipes} />
          <Route path="/form/:id" component={FormView} />
          <Route path="/draft-forms" component={DraftForms} />
          <Route path="/form-library" component={FormLibraryNew} />
          <Route path="/form-detail" component={FormDetail} />
          <Route path="/forms-library" component={FormsLibrary} />
          <Route path="/purchasing" component={Purchasing} />
          <Route path="/supplier-management" component={SupplierManagement} />
          <Route path="/test-monthly-stock" component={TestMonthlyStock} />
          <Route path="/test-email" component={TestEmailPage} />
          
          {/* Redirect old shift-reports to analysis tab */}
          <Route path="/shift-reports">
            {() => {
              window.location.href = "/reports-analysis?tab=analysis";
              return null;
            }}
          </Route>
          
          {/* Operations & Sales sub-routes */}
          <Route path="/ops-sales/draft-forms" component={DraftFormsLibrary} />
          <Route path="/ops-sales/form-library" component={DraftFormsLibrary} />
          <Route path="/ops-sales/purchasing" component={() => <Placeholder title="Purchasing" description="Manage procurement and supplier relationships." />} />
          <Route path="/ops-sales/shopping-requirements" component={() => <Placeholder title="Shopping Requirements" description="Track shopping requirements and generate purchase orders." />} />
          <Route path="/ops-sales/quick-lodge" component={() => <Placeholder title="Burger Bun, Drinks, Meat - Quick Lodge" description="Quick inventory management for key items." />} />
          <Route path="/ops-sales/sales/receipt-library" component={() => <Placeholder title="Receipt Library (by Date)" description="Browse receipts organized by date ranges." />} />
          <Route path="/ops-sales/analysis" component={() => <Placeholder title="Analysis" description="Comprehensive operational analysis and insights." />} />
          
          {/* Placeholder routes */}
          <Route path="/placeholder/business-info" component={() => <Placeholder title="Business Info" description="Update business email, contact details, and company information." />} />
          <Route path="/placeholder/logo" component={() => <Placeholder title="Amend Logo" description="Upload and manage your restaurant logo." />} />
          <Route path="/placeholder/api-keys" component={() => <Placeholder title="Secret Keys" description="Manage API keys for POS systems and external integrations." />} />
          <Route path="/placeholder/theme" component={() => <Placeholder title="Theme Settings" description="Customize dark/light mode and interface preferences." />} />
          <Route path="/placeholder/employees" component={() => <Placeholder title="Employee Creation" description="Add and manage staff accounts with role-based access." />} />
          <Route path="/placeholder/settings" component={() => <Placeholder title="Settings" description="Business info, logo upload, API keys, theme settings, and employee management." />} />
          <Route path="/placeholder/financial-analysis" component={() => <Placeholder title="Financial Analysis (AI)" description="AI-powered financial analysis with ratio calculations and insights." />} />
          <Route path="/placeholder/ratios" component={() => <Placeholder title="Ratio Calculations" description="Prime cost, food cost percentage, profit margins, and financial ratios." />} />
          <Route path="/placeholder/bank-statements" component={() => <Placeholder title="Bank Statement Upload" description="Upload and categorize bank statements for expense matching." />} />
          <Route path="/placeholder/pricing" component={() => <Placeholder title="Pricing Database" description="Key ingredients pricing database for shopping cost calculations." />} />
          <Route path="/placeholder/food-costs" component={() => <Placeholder title="Food Cost Calculations" description="Calculate food costs based on recipes and ingredient pricing." />} />
          <Route path="/placeholder/ai-descriptions" component={() => <Placeholder title="Food Description Generator (AI)" description="AI-powered food descriptions for marketing and menu creation." />} />
          <Route path="/placeholder/chat" component={() => <Placeholder title="Chat Support" description="AI-powered chat support and assistance system." />} />

          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

function AppWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <App />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default AppWrapper;

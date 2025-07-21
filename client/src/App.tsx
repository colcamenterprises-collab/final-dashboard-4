import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import DailyStockSales from "@/pages/DailyStockSales";
import DailyStockSalesQuick from "@/pages/DailyStockSalesQuick";
import DailyStockSalesSimple from "@/pages/DailyStockSalesSimple";
import DailyStockSalesSearch from "@/pages/DailyStockSalesSearch";
import PastForms from "@/pages/PastForms";
import ShoppingList from "@/pages/ShoppingList";
import Finance from "@/pages/Finance";
import ExpensesMerged from "@/pages/ExpensesMerged";
import POSLoyverse from "@/pages/POSLoyverse";
import LoyverseLive from "@/pages/LoyverseLive";
import RecipeIngredientManagement from "@/pages/RecipeIngredientManagement";
import Analysis from "@/pages/Analysis";
import ShiftAnalytics from "@/pages/ShiftAnalytics";
import WebhookManagement from "@/pages/WebhookManagement";
import Marketing from "@/pages/Marketing";
import Receipts from "@/pages/Receipts";
import Ingredients from "@/pages/Ingredients";
import Placeholder from "@/pages/Placeholder";

import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/daily-stock-sales" component={DailyStockSalesSimple} />
        <Route path="/daily-stock-sales-quick" component={DailyStockSalesQuick} />
        <Route path="/daily-stock-sales-complex" component={DailyStockSales} />
        <Route path="/daily-stock-sales/search" component={DailyStockSalesSearch} />
        <Route path="/daily-stock-sales-search" component={DailyStockSalesSearch} />
        <Route path="/past-forms" component={PastForms} />
        <Route path="/shopping-list" component={ShoppingList} />
        <Route path="/finance" component={Finance} />
        <Route path="/expenses" component={ExpensesMerged} />
        <Route path="/pos-loyverse" component={POSLoyverse} />
        <Route path="/loyverse-live" component={LoyverseLive} />
        <Route path="/recipe-management" component={RecipeIngredientManagement} />
        <Route path="/ingredient-management" component={RecipeIngredientManagement} />
        <Route path="/analysis" component={Analysis} />
        <Route path="/shift-analytics" component={ShiftAnalytics} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/receipts" component={Receipts} />
        <Route path="/ingredients" component={Ingredients} />
        
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
        <Route path="/placeholder/employees" component={() => <Placeholder title="Employees" description="Staff management and employee access controls." />} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

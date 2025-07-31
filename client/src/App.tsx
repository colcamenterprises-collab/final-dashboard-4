import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import DailyShiftForm from "@/pages/DailyShiftForm";
import DraftFormsLibrary from "@/pages/DraftFormsLibrary";
import DailySalesStock from "@/pages/DailySalesStock";
import ShoppingList from "@/pages/ShoppingList";
import Expenses from "@/pages/Expenses";
import POSLoyverse from "@/pages/POSLoyverse";
import LoyverseLive from "@/pages/LoyverseLive";
import IngredientManagement from "@/pages/IngredientManagement";
import Analysis from "@/pages/Analysis";
import ReportsAnalysis from "@/pages/ReportsAnalysis";
import Marketing from "@/pages/Marketing";
import Receipts from "@/pages/Receipts";
import Recipes from "@/pages/Recipes";
import RecipeManagement from "@/pages/RecipeManagement";
import Purchasing from "@/pages/Purchasing";
import FormView from "@/pages/FormView";
import ShiftComparison from "@/pages/ShiftComparison";

import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/daily-sales-stock" component={DailySalesStock} />
        <Route path="/daily-shift-form" component={DailyShiftForm} />
        <Route path="/shopping-list" component={ShoppingList} />
        <Route path="/expenses" component={Expenses} />
        <Route path="/pos-loyverse" component={POSLoyverse} />
        <Route path="/loyverse-live" component={LoyverseLive} />
        <Route path="/ingredient-management" component={IngredientManagement} />
        <Route path="/recipe-management" component={RecipeManagement} />
        <Route path="/reports-analysis" component={ReportsAnalysis} />
        <Route path="/analysis" component={Analysis} />
        <Route path="/shift-comparison" component={ShiftComparison} />
        <Route path="/marketing" component={Marketing} />
        <Route path="/receipts" component={Receipts} />
        <Route path="/recipes" component={Recipes} />
        <Route path="/form/:id" component={FormView} />
        <Route path="/form-library" component={DraftFormsLibrary} />
        <Route path="/purchasing" component={Purchasing} />

        {/* Redirect old shift-reports to analysis tab */}
        <Route path="/shift-reports">
          {() => {
            window.location.href = "/reports-analysis?tab=analysis";
            return null;
          }}
        </Route>
        


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

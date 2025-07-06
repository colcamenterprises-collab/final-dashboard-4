import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import DailyStockSales from "@/pages/DailyStockSales";
import DailyStockSalesSearch from "@/pages/DailyStockSalesSearch";
import ShoppingList from "@/pages/ShoppingList";
import Finance from "@/pages/Finance";
import ExpensesMerged from "@/pages/ExpensesMerged";
import POSLoyverse from "@/pages/POSLoyverse";
import LoyverseLive from "@/pages/LoyverseLive";
import RecipeManagement from "@/pages/RecipeManagement";
import Analysis from "@/pages/Analysis";
import WebhookManagement from "@/pages/WebhookManagement";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/daily-stock-sales" component={DailyStockSales} />
        <Route path="/daily-stock-sales/search" component={DailyStockSalesSearch} />
        <Route path="/shopping-list" component={ShoppingList} />
        <Route path="/finance" component={Finance} />
        <Route path="/expenses" component={ExpensesMerged} />
        <Route path="/pos-loyverse" component={POSLoyverse} />
        <Route path="/loyverse-live" component={LoyverseLive} />
        <Route path="/recipe-management" component={RecipeManagement} />
        <Route path="/analysis" component={Analysis} />

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

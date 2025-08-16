/**
 * ⚠️ LOCKED FILE — Route Registry implementation.
 * This is the FINAL implementation used in production. All alternatives were removed on purpose.
 */

import { Route, Switch } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import PageShell from "./components/PageShell";

// Import only the golden locked pages
import Overview from "./pages/dashboard/Overview";
import DailySalesStock from "./pages/operations/DailySalesStock";
import DailySalesLibrary from "./pages/operations/DailySalesLibrary";

// Placeholder pages that need to be created
function UploadStatements() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Upload Statements</h1>
      <p className="text-gray-600">Bank and credit statement upload functionality</p>
    </div>
  );
}

function Receipts() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">POS Receipts</h1>
      <p className="text-gray-600">View and manage POS receipt data</p>
    </div>
  );
}

function ShiftSummary() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Shift Summary</h1>
      <p className="text-gray-600">Detailed shift analysis and reporting</p>
    </div>
  );
}

function ProfitAndLoss() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Profit & Loss</h1>
      <p className="text-gray-600">Monthly P&L reporting with Jan-Dec columns</p>
    </div>
  );
}

function Ingredients() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Ingredients</h1>
      <p className="text-gray-600">Manage ingredient database and pricing</p>
    </div>
  );
}

function CostCalculator() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Cost Calculator</h1>
      <p className="text-gray-600">Calculate recipe costs with Chef Ramsay AI</p>
    </div>
  );
}

function NightlyChecklist() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Manager's Nightly Checklist</h1>
      <p className="text-gray-600">Randomized operational tasks with Thai support</p>
    </div>
  );
}

function App() {
  return (
    <PageShell>
      <Switch>
        <Route path="/" component={Overview} />
        <Route path="/daily-sales" component={DailySalesStock} />
        <Route path="/daily-sales-library" component={DailySalesLibrary} />
        <Route path="/upload-statements" component={UploadStatements} />
        <Route path="/receipts" component={Receipts} />
        <Route path="/shift-summary" component={ShiftSummary} />
        <Route path="/profit-and-loss" component={ProfitAndLoss} />
        <Route path="/ingredients" component={Ingredients} />
        <Route path="/cost-calculator" component={CostCalculator} />
        <Route path="/managers-nightly-checklist" component={NightlyChecklist} />
        <Route component={() => <div className="p-6 text-center"><h1 className="text-xl">Page Not Found</h1></div>} />
      </Switch>
    </PageShell>
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